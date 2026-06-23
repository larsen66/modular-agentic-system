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

// ─── Local type aliases for the optional PI SDK ───────────────────────────────
// These mirror the pi-coding-agent + pi-ai public surfaces we call. Declared
// here so the file compiles without those packages installed (they're optional
// runtime deps). When installed they must conform; if they don't the runtime
// throws and the harness settles with 'error' rather than crashing the kernel.
interface PiModel {
  provider: string;
  id: string;
}
interface PiAuthStorage {
  setRuntimeApiKey(provider: string, apiKey: string): void;
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
  nativeTools: ['read', 'bash', 'edit', 'write', 'delegate'],
};

// ─── Model resolution ────────────────────────────────────────────────────────
//
// Accept "provider/model" (e.g. "openrouter/anthropic/claude-opus-4-5"), a bare
// provider name, or nothing (let PI choose from its settings). Map to the
// { provider, modelId } pair PI's SDK uses.
function resolveProvider(model: string | undefined): { provider: string; modelId: string } | undefined {
  const explicit = model ?? process.env.PI_MODEL ?? process.env.OPENCODE_MODEL;
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

// ─── File sync helpers ────────────────────────────────────────────────────────
//
// After PI finishes, read every file from the temp cwd and write them into the
// EnvironmentHandle so the workspace inside the env is up-to-date. Skips
// PI session files (.pi/), binary files above 4 MB, and node_modules.
async function syncDirToEnv(dir: string, env: EnvironmentHandle): Promise<void> {
  const files: { path: string; content: string | Buffer }[] = [];
  await collectFiles(dir, dir, files);
  if (files.length > 0) await env.writeFiles(files);
}

async function collectFiles(
  base: string,
  current: string,
  out: { path: string; content: string | Buffer }[],
): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    const rel = path.relative(base, full);
    if (entry.name === 'node_modules' || entry.name === '.pi') continue;
    if (entry.isDirectory()) {
      await collectFiles(base, full, out);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full);
        if (stat.size > 4 * 1024 * 1024) continue; // skip large binaries
        const buf = await fs.readFile(full);
        // attempt utf-8 decode; fall back to raw buffer
        let content: string | Buffer;
        try {
          content = buf.toString('utf8');
        } catch {
          content = buf;
        }
        out.push({ path: rel, content });
      } catch {
        // skip unreadable files
      }
    }
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

      // ── Model resolution ────────────────────────────────────────────────────
      const modelRef = resolveProvider(task.model);
      let resolvedModel: ReturnType<typeof getModel> | undefined;

      if (modelRef && modelRef.modelId) {
        try {
          // getModel is fully typed: getModel(provider, modelId)
          // We cast provider + modelId as `any` because the generated model table
          // is a large readonly const — we can't statically enumerate all keys
          // at runtime without the generated types, and we want graceful fallback.
          resolvedModel = (getModel as (p: string, m: string) => ReturnType<typeof getModel> | undefined)(
            modelRef.provider,
            modelRef.modelId,
          );
          if (resolvedModel) {
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
      // agent-as-tool: route PI's 4 coding tools INTO the env via custom tool
      //   defs whose Operations call the EnvironmentHandle. tmpDir is only pi's
      //   own scratch (session housekeeping); no workspace files land on the host.
      // agent-in-sandbox: PI's default local tools run on tmpDir (the host runtime
      //   that hosts the agent); generated files sync to the env afterwards.
      const agentAsTool = task.topology === 'agent-as-tool';
      log('info', `topology: ${task.topology}`);

      // ── Router wiring ─────────────────────────────────────────────────────
      // When the kernel passes a RunContext, PI is the MAIN/router agent: expose
      // the `delegate` tool so it can dispatch sub-tasks to other harnesses/envs.
      // A recursion cap on `depth` (enforced kernel-side too) keeps PI→PI→PI from
      // running away.
      const canDelegate = Boolean(ctx?.delegate) && (ctx?.depth ?? 0) < 2;
      const delegateTool =
        canDelegate ? buildDelegateToolDefinition(defineTool, TypeBox, ctx!, io) : undefined;
      if (canDelegate) log('info', `router: delegate tool active (depth=${ctx?.depth ?? 0})`);

      // agent-as-tool: env-routed coding tools REPLACE the built-ins (same 4
      // names). agent-in-sandbox: built-ins run locally — no env-routed defs.
      const envTools = agentAsTool
        ? buildEnvRoutedToolDefinitions(toolDefFactories, env, tmpDir)
        : [];
      const customTools = [...envTools, ...(delegateTool ? [delegateTool] : [])];

      // ── Tool allowlist = the STRUCTURAL delegation boundary ────────────────
      // Router mode (PI is the main agent, can still delegate): PI gets NO
      // execution surface — only `read` (inspection) + `delegate`. Anything with
      // side effects (write/edit/run/install/build) is PHYSICALLY only reachable
      // through delegate, so the "delegate vs do-it-myself" policy is enforced by
      // the toolset, not by a promptable instruction the model can ignore.
      //
      // Leaf mode (depth cap reached, can no longer delegate): PI becomes a
      // WORKER with the full coding surface — it must do the work itself.
      let toolAllowlist: string[] | undefined;
      if (canDelegate) {
        toolAllowlist = ['read', 'delegate']; // orchestrator: inspect + dispatch only
      } else if (agentAsTool) {
        toolAllowlist = ['bash', 'read', 'write', 'edit']; // worker: full env-routed surface
      } else {
        toolAllowlist = undefined; // agent-in-sandbox leaf: default built-ins
      }

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
        // full harness/env catalog lives in the delegate tool description.
        const promptText = canDelegate
          ? `You are the MAIN orchestrating agent. Decide between two actions:\n\n` +
            `• ANSWER DIRECTLY — for pure reasoning with NO side effects: facts, math, ` +
            `explanations, plans, analysis. Just reply.\n` +
            `• DELEGATE — for ANYTHING with side effects: writing files, running or ` +
            `generating code, installing packages, building/scaffolding apps, executing ` +
            `untrusted code. Call \`delegate\` with the harness + environment that fit ` +
            `(use an isolated sandbox env for code execution). You do NOT have write/run ` +
            `tools yourself — execution happens only through delegate.\n\n` +
            `Use \`read\` only to inspect before deciding. Then answer or delegate.\n\n` +
            `User request:\n${task.prompt}`
          : task.prompt;
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

      // ── Sync generated files from tmpDir → EnvironmentHandle ─────────────
      // Only in agent-in-sandbox: PI's local tool loop wrote files into tmpDir,
      // propagate them into the env. In agent-as-tool the write/edit tools
      // already wrote straight into the env — nothing to sync.
      if (!agentAsTool) {
        try {
          await syncDirToEnv(tmpDir, env);
          log('info', 'files synced to env handle');
        } catch (err) {
          log('warn', `file sync failed: ${err instanceof Error ? err.message : String(err)}`);
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
