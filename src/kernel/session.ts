// src/kernel/session.ts
// Session FSM: Session HAS-A workspace (an opaque EnvironmentHandle); Runs are
// atomic against it. Reuse the handle across runs in the same session; provision
// on first run. The handle is a black box — the kernel never inspects its id.

import { resolveEnvironment } from '../registry/index.js';
import type {
  EnvironmentHandle,
  EnvLogger,
  ExecutionTopology,
  ProvisionSpec,
} from '../types/index.js';

export interface SessionConfig {
  sessionId: string;
  harness: string; // ref string
  environment: string; // ref string
  // Owner identity — the authenticated user this session belongs to, threaded
  // from the transport's auth context. A session is accessible ONLY to its
  // owner; cross-owner access is treated as not-found (never 403 — no leak).
  ownerId?: string;
  // Caller-supplied run id. When the transport persists the run before streaming
  // (it needs the id to stamp admission.principal), it pre-generates the id and
  // passes it here so kernel + store agree. Omitted → kernel generates one.
  runId?: string;
  source?: ProvisionSpec['source'];
  runtimeProfile?: string;
  model?: string;
  // Per-run execution-topology request (agent-as-tool ↔ agent-in-sandbox toggle).
  // Forwarded to the orchestrator, which resolves it against the (harness, env)
  // pair. Omitted → the harness default for the chosen env.
  topology?: ExecutionTopology;
  env?: Record<string, string>;
  ports?: number[];
  // Per-run capability request, forwarded to the orchestrator. Omitted → default
  // builder set. Session-shaped only by transport convenience; tools/skills are
  // resolved per run, not cached on the session.
  toolRefs?: string[];
  skillRefs?: string[];
}

interface SessionState {
  handle: EnvironmentHandle;
  environmentRef: string;
  ownerId?: string;
}

// Thrown when a caller references a live session owned by someone else. The
// transport maps this to 404 (never 403 — do not leak existence).
export class SessionOwnershipError extends Error {
  constructor() {
    super('session not found');
    this.name = 'SessionOwnershipError';
  }
}

export class SessionManager {
  private sessions = new Map<string, SessionState>();

  // Provision (or reuse) the workspace handle for a session. Awaits readiness
  // inside the adapter's provision() — no fixed kernel-side timeout, so a 150ms
  // and a 2-min cold start share one code path. `logger` (optional) is forwarded
  // to the adapter so it can narrate its substrate lifecycle into the UI.
  async ensureWorkspace(config: SessionConfig, logger?: EnvLogger): Promise<EnvironmentHandle> {
    const existing = this.sessions.get(config.sessionId);
    if (existing) assertOwner(existing, config.ownerId);
    if (existing && existing.environmentRef === config.environment) {
      logger?.('info', `reusing existing ${config.environment} workspace for session`);
      return existing.handle;
    }
    if (existing) {
      // Environment ref changed for this session — tear the old one down.
      await existing.handle.destroy().catch(() => {});
      this.sessions.delete(config.sessionId);
    }

    const environment = resolveEnvironment(config.environment);
    const spec: ProvisionSpec = {
      source: config.source ?? { kind: 'files', files: [] },
      runtimeProfile: config.runtimeProfile,
      env: config.env,
      ports: config.ports,
      logger,
    };
    const handle = await environment.provision(spec);
    this.sessions.set(config.sessionId, {
      handle,
      environmentRef: config.environment,
      ownerId: config.ownerId,
    });
    return handle;
  }

  // Owner-scoped lookup. When `ownerId` is supplied it must match the session's
  // owner, else SessionOwnershipError (→ 404). Omitting `ownerId` keeps the old
  // unauthenticated behaviour for internal callers.
  get(sessionId: string, ownerId?: string): EnvironmentHandle | undefined {
    const state = this.sessions.get(sessionId);
    if (!state) return undefined;
    assertOwner(state, ownerId);
    return state.handle;
  }

  // Lifecycle: on session end, destroy the workspace (owner-checked).
  async end(sessionId: string, ownerId?: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    assertOwner(state, ownerId);
    this.sessions.delete(sessionId);
    await state.handle.destroy().catch(() => {});
  }
}

// Cross-owner guard. Only enforced when BOTH the session and the caller carry
// an ownerId — an internal call (no ownerId) is trusted, and a legacy
// unowned session is reachable as before.
function assertOwner(state: SessionState, callerOwnerId?: string): void {
  if (callerOwnerId && state.ownerId && state.ownerId !== callerOwnerId) {
    throw new SessionOwnershipError();
  }
}
