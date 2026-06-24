// src/server/http.ts
// Fastify server. Endpoints:
//   GET  /health            → { ok, harnesses, environments }
//   GET  /registry          → the two registry listings (for the Studio dropdowns)
//   POST /message           → start a run; stream the EngineEvent SSE sequence
//   GET  /preview/:sessionId → the current preview URL for a session (if any)
//
// The server is pure transport: it builds a SessionConfig from the request and
// hands it to the Kernel. It knows nothing about containers, ports, or SDKs.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Kernel } from '../kernel/index.js';
import { SessionOwnershipError } from '../kernel/session.js';
import { serializeEvent } from './sse.js';
import type { EngineEvent, ExecutionTopology, ProvisionSource } from '../types/index.js';
// JSONL run-history persistence — the FALLBACK used only when Supabase is not
// configured. The 1:1-prod path persists to Supabase (runStore/historyRead).
import { RunRecorder, listRunMetadata, getRun } from './runHistory.js';
// Per-user isolation (1:1 prod): Bearer-JWT auth + Supabase RLS persistence.
import { authPreHandler } from './auth.js';
import { supabaseConfigured, passwordLogin } from './supabase.js';
import { createRun, appendRunEvent, completeRun } from './db/runStore.js';
import { listRunsForUser, getRunForUser, listProjectsForUser } from './db/historyRead.js';
import {
  getSessionMemory,
  promptWithSessionMemory,
  updateSessionMemory,
} from './sessionMemory.js';
// Composition-root policy: recommend the zero-config default (harness,environment)
// pair so the Studio auto-selects real generation (CLI login → real, no key).
import { recommendDefaults } from '../harnesses/cli/defaults.js';
// The main-agent PROFILE: when a request omits `harness`, the run defaults to PI
// (agent-as-tool). Composition-root policy — the kernel stays a pure ref-resolver.
import { PI_MAIN_PROFILE } from '../profiles/pi.js';
import { buildArchitectureContext, READY_PAIRS } from './architectureContext.js';

export interface MessageBody {
  // Omitted → the PI main-agent profile (harness='pi', environment='local',
  // agent-as-tool). Set explicitly to pin a specific harness/env.
  harness?: string;
  environment?: string;
  prompt: string;
  sessionId?: string;
  // Project this run belongs to. REQUIRED to persist into Supabase (the runs FK
  // needs project_id → workspace_id). Without it (or without Supabase) the run
  // streams normally but history falls back to JSONL.
  projectId?: string;
  chatId?: string;
  model?: string;
  // Execution-topology toggle: 'agent-as-tool' (agent loop on the control plane,
  // sandbox driven as a tool) or 'agent-in-sandbox' (agent process runs inside the
  // sandbox). Omitted → the kernel picks the harness default for the chosen env.
  topology?: ExecutionTopology;
  runtimeProfile?: string;
  source?: {
    kind: 'files';
    files: { path: string; content: string }[];
  };
  ports?: number[];
  // Optional capability request: which tools/skills this run wants. Omitted →
  // the orchestrator applies its default builder set.
  toolRefs?: string[];
  skillRefs?: string[];
  // Router toggle for pi. Omitted on the default build path → router OFF (lean
  // builder, fastest prompt→preview). Set true to force the router/delegate seam.
  delegation?: boolean;
}

// Pre-provision request: warm the session's sandbox on chat open so the cold
// start is paid while the user types, not on send. Only provision-relevant fields
// (no prompt/model/topology — those are run-time).
export interface WarmBody {
  sessionId?: string;
  harness?: string;
  environment?: string;
  runtimeProfile?: string;
  source?: MessageBody['source'];
  ports?: number[];
}

// Project-OPEN pre-provision request: warm a small pool of sandboxes for a project
// BEFORE any chat exists, so opening a chat adopts one instantly. Unlike WarmBody
// (one named session), this is keyed to projectId, and `source` allows git so the
// warmed sandbox already has the project repo cloned.
export interface PrewarmBody {
  projectId?: string;
  harness?: string;
  environment?: string;
  runtimeProfile?: string;
  // Full ProvisionSource (incl. git) — the warm sandbox is git-cloned at open.
  source?: ProvisionSource;
  ports?: number[];
  // Desired warm pool size for this project (default env PREWARM_POOL_SIZE).
  count?: number;
}

function runtimeProfileFor(_harness: string, _environment: string, requested?: string): string | undefined {
  return requested;
}

// API route prefixes. Used by the SPA fallback so genuine API 404s stay JSON
// instead of being shadowed by index.html. Keep in sync with the routes below.
const API_PREFIXES = [
  '/health', '/healthz', '/registry', '/architecture', '/auth',
  '/projects', '/preview', '/history', '/memory', '/message', '/warm', '/prewarm',
];

export function buildServer(kernel: Kernel) {
  const app = Fastify({ logger: false });

  // Serve the built Studio SPA same-origin (production deploy). The explicit API
  // routes below take precedence; with wildcard:false, @fastify/static serves
  // existing files (assets) and any unmatched GET falls through to the
  // notFoundHandler, which returns index.html for client-side routing — except
  // for API prefixes, which must surface as real JSON 404s. Guarded by existence
  // so local/dev (no studio build) still boots as a pure API server.
  const studioDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../studio/dist'
  );
  if (fs.existsSync(path.join(studioDist, 'index.html'))) {
    app.register(fastifyStatic, { root: studioDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      const isApi = API_PREFIXES.some(
        (p) => req.url === p || req.url.startsWith(`${p}/`) || req.url.startsWith(`${p}?`)
      );
      if (req.method === 'GET' && !isApi) {
        return reply.sendFile('index.html');
      }
      reply.code(404).send({ error: 'not found' });
    });
  }

  app.get('/health', async () => ({
    ok: true,
    harnesses: kernel.listHarnesses(),
    environments: kernel.listEnvironments(),
  }));

  app.get('/healthz', async () => {
    return {
      ok: true,
      harnesses: kernel.listHarnesses(),
      environments: kernel.listEnvironments(),
      prewarm: kernel.prewarmStats(),
    };
  });

  app.get('/registry', async () => ({
    harnesses: kernel.listHarnesses(),
    environments: kernel.listEnvironments(),
    // Verified-ready (harness × environment) pairs so the Studio can highlight
    // compatible counterparts in each dropdown. Format: 'harnessRef x envRef'.
    readyPairs: READY_PAIRS,
    // The execution-topology matrix driving the agent-as-tool ↔ agent-in-sandbox
    // toggle: per-harness supported topologies + per-env hostsAgentRuntime. The
    // Studio composes valid (harness, env, topology) triples from this.
    topologyMatrix: kernel.describeTopologies(),
    // Zero-config recommendation so the Studio auto-selects real generation.
    // Presence-only diagnostics (no secrets) — see harnesses/cli/detect.ts.
    defaults: recommendDefaults(),
    // The main-agent profile a run defaults to when `harness` is omitted.
    profile: PI_MAIN_PROFILE,
  }));

  app.get<{ Querystring: { email?: string } }>('/architecture/context', async (req) =>
    buildArchitectureContext({
      harnesses: kernel.listHarnesses(),
      environments: kernel.listEnvironments(),
      authorization: req.headers.authorization,
      email: req.query.email,
    })
  );

  // Login proxy → GoTrue. Keeps Supabase keys server-side; the Studio logs in
  // through the runner and gets back a JWT to use as Bearer on the routes below.
  app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      reply.code(400);
      return { error: 'email and password required' };
    }
    if (!supabaseConfigured()) {
      reply.code(501);
      return { error: 'Supabase not configured' };
    }
    try {
      const { accessToken, user } = await passwordLogin(email, password);
      return { accessToken, user };
    } catch {
      reply.code(401);
      return { error: 'invalid credentials' };
    }
  });

  // Projects the caller may access (RLS-scoped). Drives the Studio project
  // picker; demonstrates project-level isolation (Bob sees none of Alice's).
  app.get('/projects', { preHandler: authPreHandler }, async (req, reply) => {
    if (!supabaseConfigured()) return { projects: [] };
    const jwt = req.auth!.userJwt;
    if (!jwt) {
      reply.code(401);
      return { error: 'projects require a real JWT (RLS-scoped)' };
    }
    return { projects: await listProjectsForUser(jwt) };
  });

  // Owner-scoped preview lookup. getPreview throws SessionOwnershipError if the
  // live session belongs to another user → 404 (no existence leak). Returns the
  // ephemeral live `url` AND, when a durable snapshot exists, a same-origin
  // `static` URL the kernel serves even after the sandbox is gone.
  app.get<{ Params: { sessionId: string } }>(
    '/preview/:sessionId',
    { preHandler: authPreHandler },
    async (req, reply) => {
      try {
        const state = kernel.getPreview(req.params.sessionId, req.auth!.ownerId);
        const origin = `${req.protocol}://${req.headers.host}`;
        return {
          url: state?.url || null,
          // Trailing slash matters: the served index.html uses RELATIVE asset
          // URLs (built with `--base ./`), which resolve against this directory.
          static: state?.snapshotId ? `${origin}/preview/${req.params.sessionId}/app/` : null,
        };
      } catch (err) {
        if (err instanceof SessionOwnershipError) {
          reply.code(404);
          return { error: 'session not found' };
        }
        throw err;
      }
    }
  );

  // Serve a file from the session's DURABLE static snapshot. This is the cheap
  // read-only preview path: no live sandbox required. Owner-scoped; a missing
  // snapshot/file or a cross-owner session both 404 (no existence leak).
  app.get<{ Params: { sessionId: string; '*': string } }>(
    '/preview/:sessionId/app/*',
    { preHandler: authPreHandler },
    async (req, reply) => {
      try {
        const file = kernel.readPreviewFile(req.params.sessionId, req.auth!.ownerId, req.params['*'] ?? '');
        if (!file) {
          reply.code(404);
          return { error: 'not found' };
        }
        reply.header('content-type', file.contentType);
        // Content-addressed: a given snapshotId's bytes never change, so the
        // file is safe to cache hard for the session's lifetime.
        reply.header('cache-control', 'public, max-age=3600');
        return reply.send(fs.createReadStream(file.absPath));
      } catch (err) {
        if (err instanceof SessionOwnershipError) {
          reply.code(404);
          return { error: 'not found' };
        }
        throw err;
      }
    }
  );

  // Run history. With Supabase configured, reads run UNDER THE CALLER'S JWT, so
  // Postgres RLS (check_run_ownership) decides visibility — the server adds no
  // ownerId filter. Without Supabase, falls back to the (global) JSONL store.
  app.get('/history', { preHandler: authPreHandler }, async (req, reply) => {
    if (!supabaseConfigured()) return { runs: await listRunMetadata() };
    const jwt = req.auth!.userJwt;
    if (!jwt) {
      reply.code(401);
      return { error: 'history requires a real JWT (RLS-scoped); DEV_NO_AUTH cannot read history' };
    }
    return { runs: await listRunsForUser(jwt) };
  });

  app.get<{ Params: { runId: string } }>(
    '/history/:runId',
    { preHandler: authPreHandler },
    async (req, reply) => {
      if (!supabaseConfigured()) {
        const run = await getRun(req.params.runId);
        if (!run) {
          reply.code(404);
          return { error: 'run not found' };
        }
        return run;
      }
      const jwt = req.auth!.userJwt;
      if (!jwt) {
        reply.code(401);
        return { error: 'history requires a real JWT (RLS-scoped); DEV_NO_AUTH cannot read history' };
      }
      const run = await getRunForUser(jwt, req.params.runId);
      if (!run) {
        // RLS returned nothing — could be non-existent OR not-visible. 404 either
        // way: never reveal that a run the caller may not see exists.
        reply.code(404);
        return { error: 'run not found' };
      }
      return run;
    }
  );

  // Compact durable memory for a session. This is owner-scoped and deliberately
  // separate from /history: history is full replay; memory is the context we feed
  // into the next turn.
  app.get<{ Params: { sessionId: string } }>(
    '/memory/:sessionId',
    { preHandler: authPreHandler },
    async (req) => ({ memory: await getSessionMemory(req.auth!.ownerId, req.params.sessionId) })
  );

  // Warm a session's sandbox ahead of the first message (chat-open pre-provision).
  // Idempotent + best-effort: returns warmed:false (not an error status) on failure
  // so the client never blocks; the /message path re-provisions and surfaces errors.
  app.post<{ Body: WarmBody }>('/warm', { preHandler: authPreHandler }, async (req, reply) => {
    const body = req.body ?? {};
    const ownerId = req.auth!.ownerId;
    const sessionId = body.sessionId ?? `${ownerId.slice(0, 8)}-${randomUUID()}`;

    // Mirror /message's harness/env defaulting so the warmed (env, runtimeProfile)
    // matches what the run will request — else ensureWorkspace won't reuse it.
    const explicitHarness = Boolean(body.harness);
    const hasModelKey = Boolean(
      process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    );
    const usePiDefault = !explicitHarness && hasModelKey;
    const credFallback = !explicitHarness && !hasModelKey ? recommendDefaults() : null;
    const harness = body.harness ?? (usePiDefault ? PI_MAIN_PROFILE.harness : credFallback!.harness);
    const environment =
      body.environment ?? (usePiDefault ? PI_MAIN_PROFILE.environment : credFallback!.environment);

    try {
      await kernel.warmSession({
        sessionId,
        ownerId,
        harness,
        environment,
        runtimeProfile: runtimeProfileFor(harness, environment, body.runtimeProfile),
        source: body.source ?? { kind: 'files', files: [] },
        ports: body.ports,
      });
      return reply.send({ warmed: true, sessionId, harness, environment });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.send({ warmed: false, sessionId, harness, environment, error: message });
    }
  });

  // Project-OPEN pre-warm: keep N sandboxes ready for a project before any chat
  // exists, so opening a chat adopts one instantly. Returns immediately (warming
  // happens in the background); best-effort, so it never blocks project open.
  app.post<{ Body: PrewarmBody }>('/prewarm', { preHandler: authPreHandler }, async (req, reply) => {
    const body = req.body ?? {};
    const ownerId = req.auth!.ownerId;

    // Mirror /warm + /message harness/env defaulting so the warmed (env,
    // runtimeProfile) matches what the chat run will request — else the warm
    // handle is never adopted.
    const explicitHarness = Boolean(body.harness);
    const hasModelKey = Boolean(
      process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    );
    const usePiDefault = !explicitHarness && hasModelKey;
    const credFallback = !explicitHarness && !hasModelKey ? recommendDefaults() : null;
    const harness = body.harness ?? (usePiDefault ? PI_MAIN_PROFILE.harness : credFallback!.harness);
    const environment =
      body.environment ?? (usePiDefault ? PI_MAIN_PROFILE.environment : credFallback!.environment);

    try {
      const status = kernel.prewarmProject(
        {
          ownerId,
          projectId: body.projectId,
          environment,
          runtimeProfile: runtimeProfileFor(harness, environment, body.runtimeProfile),
          ports: body.ports,
          source: body.source,
        },
        body.count
      );
      return reply.send({ prewarming: true, projectId: body.projectId ?? null, harness, environment, ...status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.send({ prewarming: false, projectId: body.projectId ?? null, error: message });
    }
  });

  app.post<{ Body: MessageBody }>('/message', { preHandler: authPreHandler }, async (req, reply) => {
    const body = req.body;
    const ownerId = req.auth!.ownerId;
    // Server-derived, owner-prefixed session id (prod uses a server uuid). A
    // caller MAY pass an existing sessionId to continue a session — the kernel's
    // SessionManager then enforces that it belongs to this owner.
    const sessionId = body.sessionId ?? `${ownerId.slice(0, 8)}-${randomUUID()}`;
    // Pre-generate the run id so we can persist the run row (with the ownership
    // identity in admission.principal) BEFORE any event streams.
    const runId = randomUUID();
    const startedAt = Date.now();

    // ── Main-agent profile default (credential-gated) ────────────────────────
    // No explicit harness → PI via OpenRouter (harness='pi', env='local',
    // agent-as-tool) WHEN a model key exists. PI's auth needs one of OPENROUTER /
    // ANTHROPIC / OPENAI; with none, defaulting to PI would fail at auth — so we
    // degrade to recommendDefaults() (CLI login → zero-key real generation, else
    // 'none'/'none'). model/tool/skill defaults apply ONLY on the PI path, so an
    // explicit non-PI harness is never handed PI's model or caps. Topology is
    // passed through verbatim (never force-injected — forcing one would break
    // single-topology harnesses via resolveTopology).
    const explicitHarness = Boolean(body.harness);
    const hasModelKey = Boolean(
      process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    );
    const usePiDefault = !explicitHarness && hasModelKey;
    const credFallback = !explicitHarness && !hasModelKey ? recommendDefaults() : null;

    const harness = body.harness ?? (usePiDefault ? PI_MAIN_PROFILE.harness : credFallback!.harness);
    const environment =
      body.environment ?? (usePiDefault ? PI_MAIN_PROFILE.environment : credFallback!.environment);
    const model = body.model ?? (usePiDefault ? PI_MAIN_PROFILE.model : undefined);
    const toolRefs = body.toolRefs ?? (usePiDefault ? PI_MAIN_PROFILE.toolRefs : undefined);
    const skillRefs = body.skillRefs ?? (usePiDefault ? PI_MAIN_PROFILE.skillRefs : undefined);
    // Transport default: router OFF (lean builder, fastest prompt→preview). The
    // Studio always sends an explicit harness, so gating on usePiDefault never
    // fired — router stayed on. Make delegation OPT-IN over HTTP: set
    // delegation:true to enable the pi router/delegate seam. Programmatic kernel
    // callers (eval harness) drive harness.run directly with their own ctx and are
    // unaffected by this transport default.
    const delegation = body.delegation ?? false;

    // 1:1-prod persistence is active only when Supabase is configured AND the
    // run is attributed to a project (the runs FK requires project_id). Else we
    // degrade to the JSONL recorder so the build still streams without Supabase.
    // KERNEL_RUNS_PERSIST gate (default OFF): writing runs/run_events to the BOS-prod
    // project is held behind an explicit flag until the prod schema is verified
    // compatible with createRun() — never write to the live DB blind.
    const useSupabase =
      supabaseConfigured() && Boolean(body.projectId) && process.env.KERNEL_RUNS_PERSIST === '1';

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.socket?.setNoDelay(true);
    reply.raw.flushHeaders();

    // Persist the run row first so the FK + admission.principal exist before
    // events arrive. If it fails (e.g. project not found / not owned), abort
    // with a terminal frame rather than streaming an unattributable run.
    if (useSupabase) {
      try {
        await createRun({
          runId,
          ownerId,
          projectId: body.projectId!,
          sessionId,
          chatId: body.chatId ?? null,
          model: body.model ?? null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reply.raw.write(serializeEvent({ type: 'terminal', cause: 'error', error: { code: 'persist_failed', message } }));
        reply.raw.write(`event: settled\ndata: ${JSON.stringify({ runId, cause: 'error', error: { code: 'persist_failed', message } })}\n\n`);
        reply.raw.end();
        return reply;
      }
    }

    // JSONL fallback recorder (only when not using Supabase).
    const recorder = useSupabase
      ? undefined
      : new RunRecorder(runId, sessionId, harness, environment, model ?? null, body.prompt);

    // Event tee. Supabase appends are best-effort + ordered by an in-store seq
    // counter (not await order), so we fire-and-forget without blocking the SSE
    // flush. A persistence failure must never break a live run.
    const sink = (ev: EngineEvent) => {
      reply.raw.write(serializeEvent(ev));
      if (useSupabase) {
        appendRunEvent(runId, ev).catch(() => {});
      } else {
        recorder?.observe(ev);
      }
    };

    const memory = await getSessionMemory(ownerId, sessionId).catch(() => null);
    const promptForRun = promptWithSessionMemory(body.prompt, memory);

    const handle = kernel.runMessage(
      {
        sessionId,
        runId,
        ownerId,
        // Threaded so a fresh chat session can adopt a project-open pre-warmed
        // sandbox (the warm pool keys on projectId).
        projectId: body.projectId,
        harness,
        environment,
        source: body.source ?? { kind: 'files', files: [] },
        runtimeProfile: runtimeProfileFor(harness, environment, body.runtimeProfile),
        model,
        topology: body.topology,
        ports: body.ports,
        toolRefs,
        skillRefs,
        delegation,
      },
      promptForRun,
      sink
    );

    reply.raw.write(
      `event: run_started\ndata: ${JSON.stringify({ runId: handle.runId, sessionId, harness, environment })}\n\n`
    );

    let finished = false;
    reply.raw.on('close', () => {
      if (!finished) handle.cancel();
    });

    const result = await handle.result;
    finished = true;
    await updateSessionMemory({
      ownerId,
      sessionId,
      runId,
      prompt: body.prompt,
      result,
    }).catch(() => {});
    // Settle persistence (best-effort, never blocks the settlement frame).
    if (useSupabase) {
      await completeRun(runId, result, startedAt).catch(() => {});
    } else {
      await recorder?.finalize(result).catch(() => {});
    }
    reply.raw.write(`event: settled\ndata: ${JSON.stringify(result)}\n\n`);
    reply.raw.end();
    return reply;
  });

  return app;
}
