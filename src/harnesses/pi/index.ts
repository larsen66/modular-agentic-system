// src/harnesses/pi/index.ts
// PI harness — drives PI's agent loop via the @mariozechner/pi-coding-agent SDK
// (in-process). PI is the MAIN AGENT; the kernel resolves ONE ExecutionTopology
// per run and PI branches on it:
//
//   'agent-as-tool'    (default) — PI's loop runs on the control plane; its
//                       read/bash/edit/write tools execute INSIDE the opaque
//                       EnvironmentHandle via injected Operations (see envTools.ts).
//                       True isolation: nothing runs on the host. Works on EVERY
//                       env (only needs exec/readFile/writeFiles).
//   'agent-in-sandbox'           — PI's tools run on the runtime that hosts the
//                       agent (a host scratch dir), then files sync into the env.
//                       Gated by EnvironmentCapabilities.hostsAgentRuntime.
//
// SETTLE EXACTLY ONCE — every exit path (success, error, abort) funnels through
// the single `settle()` guard.
//
// Provider-agnostic: OPENROUTER_API_KEY (preferred) or ANTHROPIC_API_KEY /
// OPENAI_API_KEY for built-in providers.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerHarness } from '../../registry/index.js';
import type {
  EnvironmentHandle,
  Harness,
  HarnessCapabilities,
  RunContext,
  RunIO,
  RunTask,
} from '../../types/index.js';
import { buildEnvRoutedToolDefinitions } from './envTools.js';
import { buildDelegateToolDefinition } from './delegateTool.js';
import { buildExposePortToolDefinition } from './exposeTool.js';
import { buildSnapshotPreviewToolDefinition, autoCaptureStaticSnapshot } from './snapshotTool.js';
import { buildRouterPreamble, buildPreviewDirective } from './routerPolicy.js';

// ─── Local type aliases for the optional PI SDK ───────────────────────────────
// These mirror the pi-coding-agent + pi-ai public surfaces we call. Declared
// here so the file compiles without those packages installed (they're optional
// runtime deps). When installed they must conform; if they don't the runtime
// throws and the harness settles with 'error' rather than crashing the kernel.
interface PiModel {
  provider: string;
  id: string;
}
interface PiOAuthCredential {
  type: 'oauth';
  access: string;
  refresh: string;
  expires: number;
  [key: string]: unknown;
}
interface PiAuthStorage {
  setRuntimeApiKey(provider: string, apiKey: string): void;
  // Runtime OAuth credential (e.g. reuse the ChatGPT/Codex subscription login).
  set(provider: string, credential: PiOAuthCredential): void;
}
interface PiModelRegistry {}
interface PiSessionManager {}
interface PiSessionEvent {
  type: string;
  // message_update
  assistantMessageEvent?: { type: string; delta?: string };
  message?: { usage?: { input?: number; output?: number } };
  // tool_execution_start / tool_execution_end
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: { content?: Array<{ type: string; text?: string }> };
  isError?: boolean;
  // agent_end
  messages?: Array<{ role: string; usage?: { input?: number; output?: number } }>;
}
interface PiSession {
  subscribe(fn: (ev: PiSessionEvent) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
}

const CAPS: HarnessCapabilities = {
  providerAgnostic: true, // openrouter or built-in anthropic/openai
  streaming: true,
  // Dual-topology MAIN agent. 'agent-as-tool' is the honest default: PI's loop
  // lives on the control plane and routes tools into the env (works on any env,
  // true isolation). 'agent-in-sandbox' runs PI's tools on the host runtime that
  // hosts the agent + syncs files (needs hostsAgentRuntime).
  topologies: ['agent-as-tool', 'agent-in-sandbox'],
  defaultTopology: 'agent-as-tool',
  // PI implements these natively; in agent-as-tool read/bash/edit/write are
  // routed to the env. `delegate` is PI's router tool (dispatch a sub-task to
  // another harness/env via the kernel) — only active when RunContext is passed.
  // `expose_port` maps a server port in the env to a public preview URL — only
  // active in agent-as-tool (bash + server live inside the env there).
  nativeTools: ['read', 'bash', 'edit', 'write', 'delegate', 'expose_port'],
};

// ─── Model resolution ────────────────────────────────────────────────────────
//
// Accept "provider/model" (e.g. "openrouter/anthropic/claude-opus-4-5"), a bare
// provider name, or nothing (let PI choose from its settings). Map to the
// { provider, modelId } pair PI's SDK uses.
function resolveProvider(model: string | undefined): { provider: string; modelId: string } | undefined {
  // PI reads ONLY its own model knobs. It must NOT fall back to OPENCODE_MODEL —
  // that is opencode's cheap tool-loop model (an 8B that cannot drive PI's
  // agentic write/bash/delegate loop), and inheriting it silently made PI settle
  // 'done' with a text-only no-op (no app built). Per-run model wins, then PI_MODEL,
  // else undefined (let pi-ai pick PI's configured default).
  const explicit = model ?? process.env.PI_MODEL;
  if (!explicit) return undefined;

  // "openrouter/xxx/yyy" → provider="openrouter", modelId="xxx/yyy"
  // "anthropic/claude-opus-4-5" → provider="anthropic", modelId="claude-opus-4-5"
  const slash = explicit.indexOf('/');
  if (slash === -1) {
    // bare provider name — use default model for that provider
    return { provider: explicit, modelId: '' };
  }
  return { provider: explicit.slice(0, slash), modelId: explicit.slice(slash + 1) };
}

// ─── ChatGPT/Codex subscription auth (provider "openai-codex") ────────────────
//
// pi-ai ships a first-class `openai-codex` provider (api openai-codex-responses,
// baseUrl chatgpt.com/backend-api) — the SAME ChatGPT-subscription backend the
// `codex` CLI uses, NOT the paid OpenAI API. So the PI router can run on the
// subscription (e.g. `openai-codex/gpt-5.1-codex-max`) with no API key and no
// OpenRouter token-budget 402. We reuse the existing `codex` login by reading
// ~/.codex/auth.json and mapping its OAuth tokens into pi's OAuthCredentials
// shape ({ access, refresh, expires, … }). The `expires` is decoded from the
// access-token JWT `exp` claim so a still-valid token is used as-is; if decoding
// fails we set 0, which makes pi refresh via the refresh_token before first use.
//
// We seed this in-memory only — we never write back to ~/.codex/auth.json, so a
// pi-side token refresh cannot clobber the codex CLI's own stored login.
function decodeJwtExpMs(jwt: string): number {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return 0;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function loadCodexSubscriptionCredential(): Promise<PiOAuthCredential | undefined> {
  // Allow an explicit override of the codex auth file; default to ~/.codex/auth.json.
  const authPath = process.env.CODEX_AUTH_PATH ?? path.join(os.homedir(), '.codex', 'auth.json');
  let raw: string;
  try {
    raw = await fs.readFile(authPath, 'utf8');
  } catch {
    return undefined; // no codex login present
  }
  try {
    const parsed = JSON.parse(raw) as {
      tokens?: { access_token?: string; refresh_token?: string; id_token?: string; account_id?: string };
    };
    const t = parsed.tokens;
    if (!t?.access_token || !t?.refresh_token) return undefined;
    return {
      type: 'oauth',
      access: t.access_token,
      refresh: t.refresh_token,
      expires: decodeJwtExpMs(t.access_token),
      // Extra fields the openai-codex provider may read (chatgpt-account-id header).
      ...(t.account_id ? { account_id: t.account_id } : {}),
      ...(t.id_token ? { id_token: t.id_token } : {}),
    };
  } catch {
    return undefined; // malformed auth.json — fail soft
  }
}


// ─── Harness class ────────────────────────────────────────────────────────────

class PiHarness implements Harness {
  readonly ref = 'pi';
  readonly capabilities = CAPS;

  // Per-run session abort wiring.
  private readonly inflightAbort = new Map<string, () => void>();

  async run(task: RunTask, env: EnvironmentHandle, io: RunIO, _kit?: unknown, ctx?: RunContext): Promise<void> {
    const log = (level: 'info' | 'warn' | 'error', message: string) =>
      io.emit({ type: 'log', category: 'harness', level, message: `[pi] ${message}`, at: Date.now() });

    let settled = false;
    const settle = (
      cause: 'done' | 'error' | 'cancelled',
      error?: { code: string; message: string },
    ) => {
      if (settled) return;
      settled = true;
      io.emit({ type: 'terminal', cause, error });
    };

    // Create a dedicated temp directory for PI's cwd (workspace + session files).
    let tmpDir: string | undefined;

    try {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `pi-run-${task.runId}-`));
      log('info', `workspace temp dir: ${tmpDir}`);

      // ── Lazy-import the PI SDK (optional dep — avoids hard import at module load) ──
      // Typed as `any` because @mariozechner/pi-coding-agent and @mariozechner/pi-ai
      // are optional runtime deps not listed in package.json; tsc would fail on
      // missing module declarations. The runtime shapes are documented in the
      // pi-coding-agent README + docs/sdk.md and verified in verify.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let createAgentSession: (opts: Record<string, unknown>) => Promise<{ session: PiSession }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let AuthStorage: { inMemory(): PiAuthStorage };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ModelRegistry: { inMemory(auth: PiAuthStorage): PiModelRegistry };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let SessionManager: { inMemory(): PiSessionManager };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let getModel: (provider: string, modelId: string) => PiModel | undefined;

      // The env-routed tool-definition factories (used only in agent-as-tool).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let toolDefFactories: any;
      // The `delegate` tool surfaces: defineTool (pi) + Type (TypeBox). Pulled
      // dynamically alongside the SDK so this file compiles without the optional
      // deps installed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let defineTool: (def: any) => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let TypeBox: any;

      try {
        // Dynamic import bypasses the compile-time module-not-found error.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const piSdk = await import('@mariozechner/pi-coding-agent' as string) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const piAi = await import('@mariozechner/pi-ai' as string) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typebox = await import('typebox' as string) as any;
        createAgentSession = piSdk.createAgentSession;
        AuthStorage = piSdk.AuthStorage;
        ModelRegistry = piSdk.ModelRegistry;
        SessionManager = piSdk.SessionManager;
        getModel = piAi.getModel;
        defineTool = piSdk.defineTool;
        TypeBox = typebox.Type;
        toolDefFactories = {
          createBashToolDefinition: piSdk.createBashToolDefinition,
          createReadToolDefinition: piSdk.createReadToolDefinition,
          createWriteToolDefinition: piSdk.createWriteToolDefinition,
          createEditToolDefinition: piSdk.createEditToolDefinition,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log('error', `PI SDK not installed: ${msg}. Install @mariozechner/pi-coding-agent@0.69.0 and @mariozechner/pi-ai@0.69.0`);
        settle('error', { code: 'pi_sdk_missing', message: msg });
        return;
      }

      // ── Auth: wire API key from env vars into AuthStorage ──────────────────
      const authStorage = AuthStorage.inMemory();

      // OpenRouter (preferred when OPENROUTER_API_KEY is set): PI has first-class
      // openrouter support in @mariozechner/pi-ai — just pass the key.
      if (process.env.OPENROUTER_API_KEY) {
        authStorage.setRuntimeApiKey('openrouter', process.env.OPENROUTER_API_KEY);
        log('info', 'auth: OPENROUTER_API_KEY configured');
      }
      // Fallback: anthropic or openai built-in providers.
      if (process.env.ANTHROPIC_API_KEY) {
        authStorage.setRuntimeApiKey('anthropic', process.env.ANTHROPIC_API_KEY);
        log('info', 'auth: ANTHROPIC_API_KEY configured');
      }
      if (process.env.OPENAI_API_KEY) {
        authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY);
        log('info', 'auth: OPENAI_API_KEY configured');
      }
      // ChatGPT/Codex subscription (provider "openai-codex"): reuse the existing
      // `codex` CLI login so the router can run on the subscription with no API
      // key. Seeded only when ~/.codex/auth.json is present; harmless otherwise.
      try {
        const codexCred = await loadCodexSubscriptionCredential();
        if (codexCred) {
          authStorage.set('openai-codex', codexCred);
          log('info', 'auth: openai-codex (ChatGPT subscription) configured from codex login');
        }
      } catch {
        log('warn', 'auth: failed to load codex subscription login; skipping');
      }

      // ── Model resolution ────────────────────────────────────────────────────
      const modelRef = resolveProvider(task.model);
      let resolvedModel: ReturnType<typeof getModel> | undefined;

      if (modelRef && modelRef.modelId) {
        try {
          // getModel is fully typed: getModel(provider, modelId)
          // We cast provider + modelId as `any` because the generated model table
          // is a large readonly const — we can't statically enumerate all keys
          // at runtime without the generated types, and we want graceful fallback.
          const lookup = getModel as (p: string, m: string) => ReturnType<typeof getModel> | undefined;
          resolvedModel = lookup(modelRef.provider, modelRef.modelId);

          // openai-codex (ChatGPT subscription) ships new model ids faster than
          // pi-ai's generated registry. When the requested id is missing but the
          // provider is openai-codex, synthesize it by cloning an in-registry
          // sibling (same backend/api/cost shape) with the requested id. This is
          // what lets `openai-codex/gpt-5.5` resolve while the registry only has
          // up to gpt-5.4. Verified live: the ChatGPT account serves gpt-5.5/5.4.
          if (!resolvedModel && modelRef.provider === 'openai-codex') {
            const tmpl = lookup('openai-codex', 'gpt-5.4') ?? lookup('openai-codex', 'gpt-5.1');
            if (tmpl) {
              const siblingId = tmpl.id;
              resolvedModel = { ...(tmpl as unknown as Record<string, unknown>), id: modelRef.modelId } as unknown as typeof resolvedModel;
              log('info', `synthesized openai-codex/${modelRef.modelId} from registry sibling ${siblingId}`);
            }
          }

          if (resolvedModel) {
            // Optional output-token cap (PI_MAX_TOKENS). A model's default
            // `maxTokens` (e.g. 65536 for gpt-5.5) is sent verbatim as the
            // request's max_tokens; on a budget-limited key OpenRouter rejects
            // it with 402 and pi-ai then streams empty. Routing decisions are
            // short, so clamping the model's output cap lets expensive models
            // run within a small per-key budget. No effect when unset.
            const capRaw = process.env.PI_MAX_TOKENS;
            const cap = capRaw ? parseInt(capRaw, 10) : NaN;
            if (Number.isFinite(cap) && cap > 0) {
              const m = resolvedModel as { maxTokens?: number };
              if (typeof m.maxTokens === 'number' && m.maxTokens > cap) {
                log('info', `clamping maxTokens ${m.maxTokens} → ${cap} (PI_MAX_TOKENS)`);
                m.maxTokens = cap;
              }
            }
            log('info', `model: ${resolvedModel.provider}/${resolvedModel.id}`);
          } else {
            log('warn', `model ${modelRef.provider}/${modelRef.modelId} not found in pi-ai registry; letting PI choose`);
          }
        } catch {
          log('warn', `model lookup failed for ${modelRef.provider}/${modelRef.modelId}; letting PI choose`);
        }
      }

      // ── ModelRegistry (in-memory, no disk reads) ───────────────────────────
      const modelRegistry = ModelRegistry.inMemory(authStorage);

      // ── Topology branch ───────────────────────────────────────────────────
      // PI's agent loop runs in-process on the control plane — its Node SDK can't
      // relocate into an arbitrary sandbox. So in BOTH topologies PI executes its
      // 4 coding tools INSIDE the env via env-routed Operations and serves the
      // live preview FROM the env (expose_port). That is the only thing that
      // actually works on e2b/docker/etc: the earlier 'agent-in-sandbox' path ran
      // PI's tools on a host scratch dir with no expose_port/snapshot/preview
      // directive, so it could never surface a preview (it only "passed" on
      // daytona/codesandbox by accidentally delegating).
      //
      // The topology stays a real toggle at the kernel/matrix level (it resolves
      // exactly one and gates 'agent-in-sandbox' on hostsAgentRuntime); for PI
      // both resolve to the same env-routed execution, differing only in intent:
      // 'agent-in-sandbox' = persistent dev server + live preview (expose_port);
      // 'agent-as-tool' = build-once durable preview (snapshot_preview). Both get
      // both tools so either intent succeeds. tmpDir is ONLY pi's own scratch
      // (session housekeeping); no workspace files land on / are built on the host.
      log('info', `topology: ${task.topology} (env-routed execution)`);

      // ── Router wiring ─────────────────────────────────────────────────────
      // When the kernel passes a RunContext, PI is the MAIN/router agent: expose
      // the `delegate` tool so it can dispatch sub-tasks to other harnesses/envs.
      // A recursion cap on `depth` (enforced kernel-side too) keeps PI→PI→PI from
      // running away.
      const canDelegate = Boolean(ctx?.delegate) && (ctx?.depth ?? 0) < 2;
      const delegateTool =
        canDelegate ? buildDelegateToolDefinition(defineTool, TypeBox, ctx!, io) : undefined;
      if (canDelegate) log('info', `router: delegate tool active (depth=${ctx?.depth ?? 0})`);

      // Env-routed coding tools REPLACE the built-ins (same 4 names) so every
      // bash/read/write/edit call executes INSIDE the env. Active in BOTH
      // topologies (PI's loop is on the control plane regardless).
      const envTools = buildEnvRoutedToolDefinitions(toolDefFactories, env, tmpDir);

      // expose_port: PI's bash (and any server it backgrounds) run INSIDE the env,
      // so env.exposePort maps the right port → live preview. Active in both
      // topologies; it's the REQUIRED preview path for agent-in-sandbox.
      const exposeTool = buildExposePortToolDefinition(defineTool, TypeBox, env, io);

      // snapshot_preview: tars the build dir PI's bash produced INSIDE the env into
      // a durable static preview. Active in both topologies; it's the build-once
      // preview path for agent-as-tool and a durable fallback for agent-in-sandbox.
      const snapshotTool = buildSnapshotPreviewToolDefinition(defineTool, TypeBox, env, io);

      const customTools = [
        ...envTools,
        ...(exposeTool ? [exposeTool] : []),
        ...(snapshotTool ? [snapshotTool] : []),
        ...(delegateTool ? [delegateTool] : []),
      ];

      // ── Tool allowlist: PI is a GENERALIST that can also escalate ──────────
      // PI keeps the FULL coding surface (read/write/edit/bash) so it can DO
      // simple/normal work itself, and gets `delegate` on top so it can hand off
      // to a better-fit specialized harness. The do-it-myself-vs-delegate line is
      // a PROMPT CRITERION (see preamble + delegate description), not a structural
      // gate — PI must be able to act, then choose to escalate only when warranted.
      // env-routed coding tools (always) + the preview tools + delegate (when PI is
      // the router). Pin exactly the active set so PI can't reach a stray built-in.
      const toolAllowlist: string[] = [
        'bash',
        'read',
        'write',
        'edit',
        'expose_port',
        'snapshot_preview',
        ...(delegateTool ? ['delegate'] : []),
      ];

      // ── Create AgentSession in the temp workspace ─────────────────────────
      log('info', 'creating PI agent session');
      const sessionResult = await createAgentSession({
        cwd: tmpDir,
        authStorage,
        modelRegistry,
        sessionManager: SessionManager.inMemory(),
        ...(resolvedModel ? { model: resolvedModel } : {}),
        // Custom tools = env-routed coding tools (agent-as-tool) + delegate (when
        // PI is the router). The allowlist pins exactly the active set.
        ...(customTools.length > 0 ? { customTools } : {}),
        ...(toolAllowlist ? { tools: toolAllowlist } : {}),
      });
      const session = sessionResult.session;

      // ── Wire abort: task.signal triggers session.abort() ──────────────────
      const abortFn = () => {
        void session.abort().catch(() => undefined);
      };
      this.inflightAbort.set(task.runId, abortFn);
      task.signal.addEventListener('abort', abortFn);

      // ── Accumulate final text from text_delta events ─────────────────────
      let finalText = '';
      let usageInput = 0;
      let usageOutput = 0;
      // Auto-snapshot bookkeeping: did PI surface a live preview, and did it
      // already capture a durable snapshot itself? If it exposed but never
      // snapshotted, the harness auto-captures one at end-of-run (safety net) so
      // reopening the chat shows the app even after the sandbox dies.
      let exposed = false;
      let snapshotCaptured = false;

      // ── Subscribe to PI events → EngineEvent translation ─────────────────
      const unsubscribe = session.subscribe((event) => {
        if (settled) return;

        switch (event.type) {
          // Text streaming
          case 'message_update': {
            const ae = event.assistantMessageEvent;
            if (ae && ae.type === 'text_delta' && ae.delta) {
              io.emit({ type: 'stream_chunk', text: ae.delta });
              finalText += ae.delta;
            }
            // Track cumulative usage from the partial message's usage field.
            // pi-ai Usage: { input, output, ... }
            const msg = event.message;
            if (msg?.usage) {
              const nextIn = msg.usage.input ?? 0;
              const nextOut = msg.usage.output ?? 0;
              const dIn = Math.max(0, nextIn - usageInput);
              const dOut = Math.max(0, nextOut - usageOutput);
              usageInput = Math.max(usageInput, nextIn);
              usageOutput = Math.max(usageOutput, nextOut);
              if (dIn > 0 || dOut > 0) {
                io.emit({ type: 'usage_delta', inputTokens: dIn, outputTokens: dOut });
              }
            }
            break;
          }

          // Tool call started
          case 'tool_execution_start': {
            io.emit({
              type: 'tool_call',
              name: event.toolName ?? 'tool',
              args: event.args,
              callId: event.toolCallId,
            });
            break;
          }

          // Tool call completed
          case 'tool_execution_end': {
            // Track preview lifecycle for the end-of-run auto-snapshot decision.
            if (!event.isError && event.toolName === 'expose_port') exposed = true;
            if (!event.isError && event.toolName === 'snapshot_preview') snapshotCaptured = true;
            const output = event.result?.content
              ?.filter((c) => c.type === 'text')
              .map((c) => c.text ?? '')
              .join('')
              .slice(0, 800);
            io.emit({
              type: 'tool_result',
              ok: !event.isError,
              output: output ?? '',
              callId: event.toolCallId,
            });
            break;
          }

          // Agent completed its run
          case 'agent_end': {
            const messages = event.messages ?? [];
            // Final usage from the last assistant message
            const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant?.usage) {
              const totalIn = lastAssistant.usage.input ?? 0;
              const totalOut = lastAssistant.usage.output ?? 0;
              const dIn = Math.max(0, totalIn - usageInput);
              const dOut = Math.max(0, totalOut - usageOutput);
              if (dIn > 0 || dOut > 0) {
                io.emit({ type: 'usage_delta', inputTokens: dIn, outputTokens: dOut });
              }
            }
            if (finalText.trim()) {
              io.emit({ type: 'final_text', text: finalText.trim() });
            }
            settle('done');
            break;
          }

          default:
            break; // queue_update, compaction_start/end, auto_retry — ignore
        }
      });

      try {
        // ── Fire the prompt — PI drives the full agent+tool loop ──────────
        // When routing is active, prepend the orchestration policy. The boundary
        // is already enforced structurally (router PI has only read + delegate),
        // so this just tells PI HOW to decide — not a rule it could bypass. The
        // full harness/env catalog lives in the delegate tool description. The
        // policy text itself is the single tunable knob in routerPolicy.ts.
        // In agent-as-tool PI can serve+expose inside the env (it has expose_port),
        // so prepend the live-preview directive — it's the difference between a
        // blank iframe and a running app. The router preamble (when delegating) is
        // layered on top.
        const previewDirective = exposeTool ? buildPreviewDirective() : '';
        const promptText = previewDirective + (canDelegate ? buildRouterPreamble(task.prompt) : task.prompt);
        log('info', `prompting PI (model: ${resolvedModel ? `${resolvedModel.provider}/${resolvedModel.id}` : 'auto'})`);
        await session.prompt(promptText);
      } catch (err) {
        unsubscribe();
        if (task.signal.aborted) {
          settle('cancelled');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          log('error', `session.prompt failed: ${message}`);
          settle('error', { code: 'pi_prompt_error', message });
        }
        return;
      }

      unsubscribe();
      session.dispose();

      // No host→env file sync: PI's env-routed write/edit tools wrote straight into
      // the env in both topologies. tmpDir only ever held PI's own session scratch.

      // ── Auto-snapshot safety net ──────────────────────────────────────────
      // If PI surfaced a LIVE preview but never captured a DURABLE snapshot, do it
      // now (best-effort, non-fatal). The pump records snapshotId on the session's
      // PreviewRegistry regardless of settlement, so GET /preview then returns a
      // `static` URL that survives the sandbox dying — "reopen chat → see the app".
      // Skipped when nothing was exposed (non-web task) or PI already snapshotted.
      if (exposed && !snapshotCaptured && !task.signal.aborted) {
        try {
          await autoCaptureStaticSnapshot(env, io, (level, message) => log(level, message));
        } catch (err) {
          log('warn', `auto-snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Ensure we've settled (agent_end fires from subscribe before prompt()
      // resolves in some PI versions, but just in case):
      if (!settled) {
        if (finalText.trim()) io.emit({ type: 'final_text', text: finalText.trim() });
        settle(task.signal.aborted ? 'cancelled' : 'done');
      }
    } catch (err) {
      if (task.signal.aborted) {
        settle('cancelled');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        log('error', message);
        settle('error', { code: 'pi_harness_error', message });
      }
    } finally {
      task.signal.removeEventListener('abort', this.inflightAbort.get(task.runId) ?? (() => undefined));
      this.inflightAbort.delete(task.runId);

      // Clean up temp dir (best effort; don't block settlement).
      if (tmpDir) {
        fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  async cancel(runId: string): Promise<void> {
    this.inflightAbort.get(runId)?.();
  }
}

registerHarness('pi', () => new PiHarness());
