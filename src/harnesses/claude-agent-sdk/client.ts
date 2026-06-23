// src/harnesses/claude-agent-sdk/client.ts
// Config + health + lazy loader for the REAL Claude Agent SDK
// (`@anthropic-ai/claude-agent-sdk`, the `query()` agent loop). This replaces the
// previous raw Messages-API (`@anthropic-ai/sdk`) implementation: we no longer
// hand-roll the tool loop — the Agent SDK owns the loop, context management, and
// permissions, and we route every side effect OUT to the EnvironmentHandle via
// in-process SDK MCP tools (see tools.ts). The env seam stays intact because the
// built-in filesystem/shell tools are denied and only our sandbox-routed tools
// are allowed.
//
// AUTH (4 modes, in precedence order):
//   1. api-key      — ANTHROPIC_API_KEY (the documented production path)
//   2. oauth-token  — CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` (portable
//                     subscription token; the headless subscription workaround)
//   3. base-url     — ANTHROPIC_BASE_URL / CLAUDE_SDK_BASE_URL compat endpoint
//   4. subscription — fall back to the machine's existing Claude Code login
//                     (Pro/Max via Keychain / ~/.claude). The bundled `claude`
//                     subprocess reads those creds itself; we MUST NOT inject a
//                     placeholder ANTHROPIC_API_KEY or it forces (broken) key auth.
// NOTE: subscription auth is for LOCAL/personal use per Anthropic's `setup-token`
// flow — do not ship a distributed product authenticating on a claude.ai login.

import { detectClaude } from '../cli/detect.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export type ClaudeAuthMode = 'api-key' | 'oauth-token' | 'base-url' | 'subscription';

export interface ClaudeClientConfig {
  apiKey?: string;
  oauthToken?: string; // CLAUDE_CODE_OAUTH_TOKEN (subscription token)
  baseURL?: string; // ANTHROPIC_BASE_URL override (compat proxy / gateway)
  model: string;
  authMode: ClaudeAuthMode;
}

// Cache the (spawn-backed) subscription-login probe so resolveConfig stays cheap
// on the hot path (it is called per-run and by the health endpoint).
let subscriptionCache: boolean | null = null;
function subscriptionLoginPresent(): boolean {
  if (subscriptionCache === null) {
    try {
      subscriptionCache = detectClaude().loggedIn;
    } catch {
      subscriptionCache = false;
    }
  }
  return subscriptionCache;
}

// Resolve config from env + the machine's Claude Code login. Returns null only
// when NO auth path is available (no key, no token, no base-URL, no subscription
// login) so callers can SKIP cleanly rather than throw.
export function resolveConfig(opts?: { model?: string }): ClaudeClientConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '';
  const baseURL = process.env.CLAUDE_SDK_BASE_URL ?? process.env.ANTHROPIC_BASE_URL ?? undefined;

  let authMode: ClaudeAuthMode | null = null;
  if (apiKey) authMode = 'api-key';
  else if (oauthToken) authMode = 'oauth-token';
  else if (baseURL) authMode = 'base-url';
  else if (subscriptionLoginPresent()) authMode = 'subscription';
  if (!authMode) return null;

  // Only Claude model ids here. We deliberately do NOT fall back to SDK_MODEL —
  // that env var carries the OpenRouter/OpenAI model for the provider-agnostic
  // `sdk` harness (e.g. "openai/gpt-4o-mini"), which the Agent SDK cannot run.
  const model = opts?.model ?? process.env.CLAUDE_SDK_MODEL ?? DEFAULT_MODEL;
  return {
    apiKey: apiKey || undefined,
    oauthToken: oauthToken || undefined,
    baseURL,
    model,
    authMode,
  };
}

export class NoClaudeConfigError extends Error {
  constructor() {
    super(
      'claude-agent-sdk harness is not configured. Set ANTHROPIC_API_KEY, or ' +
        'CLAUDE_CODE_OAUTH_TOKEN (via `claude setup-token`), or log into Claude Code ' +
        '(Pro/Max subscription), or set an ANTHROPIC_BASE_URL compat endpoint.'
    );
    this.name = 'NoClaudeConfigError';
  }
}

// ── Lazy loader for the Agent SDK ────────────────────────────────────────────
// The package is a real dependency now (it bundles a native `claude` binary), but
// we still import it lazily so a misconfigured/missing install surfaces as a clean
// terminal error rather than crashing module load of the whole kernel. The three
// functions are all we use: query (the agent loop), createSdkMcpServer + tool (the
// in-process tools we route to the EnvironmentHandle).
export interface AgentSdkModule {
  query: (params: { prompt: string | AsyncIterable<unknown>; options?: Record<string, unknown> }) => AsyncGenerator<AgentSdkMessage, void> & {
    interrupt(): Promise<void>;
    close(): void;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: (...args: any[]) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createSdkMcpServer: (opts: { name: string; version?: string; tools?: unknown[] }) => any;
}

// The slice of the SDKMessage union we translate. The Agent SDK yields many more
// variants (status, hooks, task progress, …) — we read only what maps to the
// canonical EngineEvent set and ignore the rest.
export interface AgentSdkMessage {
  type: string;
  subtype?: string;
  // assistant message → Anthropic BetaMessage with content blocks + usage
  message?: {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  // result message
  result?: string;
  is_error?: boolean;
  usage?: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
  errors?: string[];
  // init / diagnostics
  model?: string;
  session_id?: string;
}

let cached: Promise<AgentSdkModule> | null = null;

export async function loadAgentSdk(): Promise<AgentSdkModule> {
  if (!cached) {
    const pkg = ['@anthropic-ai', 'claude-agent-sdk'].join('/');
    cached = import(pkg).then((mod) => {
      const { query, tool, createSdkMcpServer } = mod as unknown as AgentSdkModule;
      if (typeof query !== 'function' || typeof tool !== 'function' || typeof createSdkMcpServer !== 'function') {
        throw new Error('@anthropic-ai/claude-agent-sdk is installed but missing query/tool/createSdkMcpServer exports.');
      }
      return { query, tool, createSdkMcpServer };
    });
  }
  return cached;
}

// Non-throwing health summary: is the adapter configured, and via which auth path?
// `real` is true for any path that reaches a real model (everything but base-url,
// which may point at a mock/proxy).
export interface ClaudeSdkHealth {
  available: boolean; // can the harness run at all (any auth path resolves)?
  real: boolean; // true for api-key / oauth-token / subscription (not base-url)
  model: string | null;
  mode: ClaudeAuthMode | 'unconfigured';
}

export function describeClaudeSdk(): ClaudeSdkHealth {
  const cfg = resolveConfig();
  if (!cfg) return { available: false, real: false, model: null, mode: 'unconfigured' };
  return {
    available: true,
    real: cfg.authMode !== 'base-url',
    model: cfg.model,
    mode: cfg.authMode,
  };
}
