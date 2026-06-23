// src/harnesses/opencode/index.ts
// The REAL OpenCode harness (mode 2, harness-INSIDE-env). Unlike the SDK harness
// (mode 1, the agent loop runs on the control plane and routes every tool OUT to
// the handle), OpenCode owns its OWN agent loop and runs tools on its OWN disk
// INSIDE the execution environment. The kernel never sees a single tool call as a
// `handle.exec` — instead it spawns `opencode serve` inside the env, drives it
// over HTTP+SSE, and translates OpenCode's native event firehose into the
// canonical EngineEvent set.
//
// Flow (harnesses-remote.md §2 + the four-step shape in §Cross-cutting):
//   1. spawn `opencode serve --pure --port 4096 --hostname 0.0.0.0` INSIDE env (detached)
//   2. waitForPort + exposePort → drive URL (kernel never learns the host port)
//   3. session.create() → session.prompt({ parts:[text], model }) (fire async)
//   4. event.subscribe() SSE → translate message.part.updated / message.updated /
//      session.idle / session.error → EngineEvent via io.emit, settle EXACTLY once.
//
// Provider-agnostic: OpenCode is built on the Vercel AI SDK. We configure it to
// target an OpenAI-compatible base URL (the platform's model-router-gw, OpenRouter,
// or any OpenAI-compatible endpoint) via OPENAI_BASE_URL / OPENAI_API_KEY injected
// into the env at provision time. `task.model` is resolved to {providerID, modelID}.

import { createOpencodeClient } from '@opencode-ai/sdk';
import { registerHarness } from '../../registry/index.js';
import type {
  EnvironmentHandle,
  Harness,
  HarnessCapabilities,
  RunIO,
  RunTask,
} from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';

const CAPS: HarnessCapabilities = {
  providerAgnostic: true,
  streaming: true,
  topologies: ['agent-in-sandbox'], // spawns `opencode serve` INSIDE the env
  defaultTopology: 'agent-in-sandbox',
};

const OPENCODE_BASE_PORT = 4096;
const SERVE_READY_TIMEOUT_MS = 60_000;
const PROMPT_TIMEOUT_MS = 600_000; // a real agent build can run minutes

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function portForRun(runId: string): number {
  let hash = 0;
  for (const ch of runId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return OPENCODE_BASE_PORT + 1 + (hash % 700);
}

// OpenCode addresses a model as a (providerID, modelID) pair. The kernel hands a
// single provider-agnostic `task.model` string; resolve it. Accept the canonical
// "provider/model" form (e.g. "openrouter/anthropic/claude-3.5-sonnet" →
// provider="openrouter", model="anthropic/claude-3.5-sonnet"), or fall back to the
// env-configured default provider so an OpenAI-compatible base URL just works.
function resolveModel(
  model: string | undefined
): { providerID: string; modelID: string } | undefined {
  const explicit = model ?? process.env.OPENCODE_MODEL;
  if (explicit && explicit.includes('/')) {
    const slash = explicit.indexOf('/');
    return { providerID: explicit.slice(0, slash), modelID: explicit.slice(slash + 1) };
  }
  if (explicit) {
    // No provider prefix — pair it with the configured default provider.
    return { providerID: process.env.OPENCODE_PROVIDER ?? 'openai', modelID: explicit };
  }
  // Nothing specified: let OpenCode pick its configured default (return undefined
  // so we omit `model` from the prompt body entirely).
  return undefined;
}

// The OpenCode SDK clients are HeyApi-generated: every call resolves to
// `{ data?, error?, ... }`. Narrow to the payload, throwing on a transport error
// so settlement surfaces it rather than silently proceeding on `undefined`.
function unwrap<T>(res: { data?: T; error?: unknown }, what: string): T {
  if (res.error) {
    const msg = res.error instanceof Error ? res.error.message : JSON.stringify(res.error);
    throw new Error(`opencode ${what} failed: ${msg}`);
  }
  if (res.data === undefined) throw new Error(`opencode ${what} returned no data`);
  return res.data;
}

async function unwrapWithRetry<T>(
  action: () => Promise<{ data?: T; error?: unknown }>,
  what: string,
  log: (level: 'info' | 'warn' | 'error', message: string) => void
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await action();
    if (!res.error && res.data !== undefined) return res.data;
    last = res.error ?? new Error(`${what} returned no data`);
    const msg = last instanceof Error ? last.message : JSON.stringify(last);
    if (!/wal_checkpoint|sqlite|drizzle|database/i.test(msg) || attempt === 4) break;
    log('warn', `${what} database not ready (attempt ${attempt}/4); retrying`);
    await sleep(750 * attempt);
  }
  return unwrap({ error: last }, what);
}

async function requireOpencodeCli(
  env: EnvironmentHandle,
  log: (level: 'info' | 'warn' | 'error', message: string) => void
): Promise<void> {
  const probe = await env.exec('command -v opencode && opencode --version', {
    timeoutMs: 30_000,
  });
  if (isProcessHandle(probe)) {
    await probe.kill().catch(() => {});
    throw new Error('opencode CLI preflight unexpectedly started a background process');
  }
  if (probe.exitCode !== 0) {
    const detail = truncate(probe.stderr || probe.stdout || 'opencode not found', 400);
    throw new Error(
      `opencode CLI is not installed inside the selected environment. ` +
        `Use environment=local with a host opencode install, or choose an agent-as-tool harness ` +
        `such as openai-agents/sdk for managed sandboxes like daytona. Preflight: ${detail}`
    );
  }
  const lines = probe.stdout.trim().split(/\r?\n/).filter(Boolean);
  const version = lines[lines.length - 1] ?? 'found';
  log('info', `opencode CLI available (${truncate(version, 120)})`);
}

class OpenCodeHarness implements Harness {
  readonly ref = 'opencode';
  readonly capabilities = CAPS;

  // Per-run abort wiring so cancel(runId) can tear down the in-flight stream.
  private readonly inflight = new Map<string, AbortController>();

  async run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    const log = (level: 'info' | 'warn' | 'error', message: string) =>
      io.emit({ type: 'log', category: 'harness', level, message: `[opencode] ${message}`, at: Date.now() });

    // A single abort signal that fires on task cancel OR our own cancel() call.
    const localAbort = new AbortController();
    this.inflight.set(task.runId, localAbort);
    const onTaskAbort = () => localAbort.abort();
    task.signal.addEventListener('abort', onTaskAbort);

    // Settle EXACTLY once — the discipline the SDK harness proves. Every exit path
    // (success, error, cancel) funnels through here; the guard makes re-entry a
    // no-op so a late SSE error after a clean idle can't double-settle.
    let settled = false;
    const settle = (cause: 'done' | 'error' | 'cancelled', error?: { code: string; message: string }) => {
      if (settled) return;
      settled = true;
      io.emit({ type: 'terminal', cause, error });
    };

    let usageInput = 0;
    let usageOutput = 0;
    let finalText = '';

    try {
      await requireOpencodeCli(env, log);

      // 1. Start the OpenCode server INSIDE the env (mode 2). Bind 0.0.0.0 so the
      //    adapter's port proxy can reach it; --print-logs keeps it diagnosable.
      //    OPENAI_BASE_URL/OPENAI_API_KEY are expected to be in the env (injected at
      //    provision), making OpenCode provider-agnostic against any OpenAI wire.
      const port = portForRun(task.runId);
      log('info', `starting \`opencode serve\` on :${port} inside the env`);
      const serveCmd = [
        `mkdir -p .opencode-home .config .local/share .cache .local/state .runtime`,
        [
          `export`,
          `HOME="$PWD/.opencode-home"`,
          `XDG_CONFIG_HOME="$PWD/.config"`,
          `XDG_DATA_HOME="$PWD/.local/share"`,
          `XDG_CACHE_HOME="$PWD/.cache"`,
          `XDG_STATE_HOME="$PWD/.local/state"`,
          `XDG_RUNTIME_DIR="$PWD/.runtime"`,
          `;`,
          `opencode db path >/dev/null 2>&1`,
          `&&`,
          `opencode serve --pure --port ${port} --hostname 0.0.0.0`,
        ].join(' '),
      ].join(' && ');
      const proc = await env.exec(serveCmd, {
        detached: true,
        onStdout: (chunk) => {
          const t = chunk.trim();
          if (t) log('info', `server stdout: ${truncate(t, 400)}`);
        },
        onStderr: (chunk) => {
          const t = chunk.trim();
          if (t) log('warn', `server stderr: ${truncate(t, 400)}`);
        },
      });
      // detached exec may return either a ProcessHandle (local env) or an
      // ExecResult carrying a logfile path (docker env). Either is fine — the
      // server is now backgrounded; readiness is decided by the port probe.
      if (isProcessHandle(proc)) {
        // If it dies immediately the port probe below will time out and report it.
        void proc.poll();
      }

      // 2. Wait for the server, then resolve the drive URL through the handle. The
      //    kernel/handle hides whether that's a docker host-port proxy or a plain
      //    localhost bind — we just get a finished base URL.
      if (env.waitForPort) {
        await env.waitForPort(port, SERVE_READY_TIMEOUT_MS);
      }
      const { url, token } = await env.exposePort(port);
      log('info', `server reachable at ${url}; creating session`);

      const client = createOpencodeClient({
        baseUrl: url.replace(/\/$/, ''),
        ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      });

      // 3. Subscribe to the global SSE event stream BEFORE prompting so no early
      //    message parts are missed (OpenCode's /event is a global firehose).
      const sse = await client.event.subscribe({ signal: localAbort.signal });

      // 4. Create a session and fire the prompt asynchronously — the reply arrives
      //    over the SSE stream we just opened, not from this call's return value.
      const session = await unwrapWithRetry(
        () => client.session.create(),
        'session.create',
        log
      );
      const sessionId = (session as { id: string }).id;
      const model = resolveModel(task.model);
      log('info', `session ${sessionId}; prompting${model ? ` (model ${model.providerID}/${model.modelID})` : ''}`);

      const promptBody: {
        parts: Array<{ type: 'text'; text: string }>;
        model?: { providerID: string; modelID: string };
      } = {
        parts: [{ type: 'text', text: task.prompt }],
      };
      if (model) promptBody.model = model;

      // promptAsync returns immediately; we read the result off the SSE stream.
      // (Fall back to prompt() if the build lacks promptAsync.)
      const fire = client.session.promptAsync
        ? client.session.promptAsync({ path: { id: sessionId }, body: promptBody, signal: localAbort.signal })
        : client.session.prompt({ path: { id: sessionId }, body: promptBody, signal: localAbort.signal });
      // Don't await completion here — but surface a fire-time transport error.
      void Promise.resolve(fire).catch((err) => {
        if (localAbort.signal.aborted) return;
        log('error', `prompt dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
        settle('error', { code: 'opencode_prompt_failed', message: String(err) });
      });

      // 5. Translate the native firehose → EngineEvent, scoped to THIS session.
      for await (const event of sse.stream as unknown as AsyncIterable<OpenCodeEvent>) {
        if (settled) break;
        if (localAbort.signal.aborted) break;

        switch (event.type) {
          case 'message.part.updated': {
            const part = event.properties?.part;
            if (!part || part.sessionID !== sessionId) break;
            if (part.type === 'text') {
              // Prefer the incremental delta when present; else the full text.
              const text = event.properties?.delta ?? part.text ?? '';
              if (text) {
                io.emit({ type: 'stream_chunk', text });
                finalText += event.properties?.delta != null ? text : '';
              }
            } else if (part.type === 'tool') {
              const status = part.state?.status;
              if (status === 'running' || status === 'pending') {
                io.emit({ type: 'tool_call', name: part.tool ?? 'tool', args: part.state?.input, callId: part.callID });
              } else if (status === 'completed') {
                io.emit({ type: 'tool_result', ok: true, output: truncate(part.state?.output), callId: part.callID });
              } else if (status === 'error') {
                io.emit({ type: 'tool_result', ok: false, output: truncate(part.state?.error), callId: part.callID });
              }
            }
            break;
          }

          case 'message.updated': {
            // Assistant token accounting lives on the message info. Recompute the
            // delta from the cumulative totals OpenCode reports.
            const info = event.properties?.info;
            if (info?.sessionID === sessionId && info.role === 'assistant' && info.tokens) {
              const nextIn = info.tokens.input ?? 0;
              const nextOut = info.tokens.output ?? 0;
              const dIn = Math.max(0, nextIn - usageInput);
              const dOut = Math.max(0, nextOut - usageOutput);
              usageInput = Math.max(usageInput, nextIn);
              usageOutput = Math.max(usageOutput, nextOut);
              if (dIn > 0 || dOut > 0) {
                io.emit({ type: 'usage_delta', inputTokens: dIn, outputTokens: dOut });
              }
              // A surfaced provider/model error on the assistant message is terminal.
              if (info.error) {
                const message =
                  (info.error as { data?: { message?: string } }).data?.message ??
                  JSON.stringify(info.error);
                settle('error', { code: 'opencode_message_error', message });
              }
            }
            break;
          }

          case 'session.error': {
            if (event.properties?.sessionID && event.properties.sessionID !== sessionId) break;
            const err = event.properties?.error;
            const message =
              (err as { data?: { message?: string } } | undefined)?.data?.message ??
              (err ? JSON.stringify(err) : 'unknown session error');
            settle('error', { code: 'opencode_session_error', message });
            break;
          }

          case 'session.idle': {
            // The session went idle for our session → the agent finished its turn.
            if (event.properties?.sessionID === sessionId) {
              if (finalText.trim()) io.emit({ type: 'final_text', text: finalText.trim() });
              settle('done');
            }
            break;
          }

          default:
            break; // ignore the rest of the firehose (file.watcher, lsp, etc.)
        }
      }

      // Stream ended without an explicit terminal event (server closed / aborted).
      if (!settled) {
        settle(localAbort.signal.aborted ? 'cancelled' : 'done');
      }
    } catch (err) {
      if (localAbort.signal.aborted) {
        settle('cancelled');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        log('error', message);
        settle('error', { code: 'opencode_harness_error', message });
      }
    } finally {
      task.signal.removeEventListener('abort', onTaskAbort);
      this.inflight.delete(task.runId);
    }
  }

  async cancel(runId: string): Promise<void> {
    this.inflight.get(runId)?.abort();
  }
}

function truncate(s: string | undefined, max = 800): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Minimal local shapes for the native events we translate ─────────────────
// We deliberately re-declare only the fields we read (not the full SDK union) so
// this adapter is robust to additive SDK changes and so the harness layer doesn't
// depend on a specific generated symbol surface beyond the runtime client.
interface OpenCodeToolState {
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: unknown;
  output?: string;
  error?: string;
}
interface OpenCodePart {
  type: string;
  sessionID: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: OpenCodeToolState;
}
interface OpenCodeAssistantInfo {
  sessionID: string;
  role: string;
  tokens?: { input?: number; output?: number };
  error?: unknown;
}
// A single flat shape (not a discriminated union): the SDK's Event union includes
// an open `{ type: string }` member that would collapse `properties` to `{}` under
// narrowing, so we read `event.type` as a plain string and access the (all-optional)
// property bag directly. Robust to additive SDK event kinds.
interface OpenCodeEvent {
  type: string;
  properties?: {
    part?: OpenCodePart;
    delta?: string;
    info?: OpenCodeAssistantInfo;
    sessionID?: string;
    error?: unknown;
  };
}

registerHarness('opencode', () => new OpenCodeHarness());
