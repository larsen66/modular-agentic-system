// src/kernel/prewarmPool.ts
// Project-open warm pool. When the Studio opens a project we pre-provision a few
// sandboxes (full git clone of the project) AHEAD of any chat, so opening a chat
// claims a ready handle instead of paying the cold Sandbox.create + materialize.
//
// Substrate-agnostic, like SessionManager: it only touches the registry +
// environment.provision()/handle.destroy(); it never learns there is an e2b
// microVM behind the EnvironmentHandle. The whole feature is "warm a handle
// early, hand it to the session later" — no substrate knowledge leaks in.
//
// Lifecycle (chosen design): warm pool of N free handles per project, each with
// a TTL + auto-kill. If a chat never opens, the unclaimed handle is destroyed
// when its TTL fires — e2b is billed for idle, so we never let a warmed-but-
// unused sandbox linger. There is no project-close signal; TTL is the only
// reaper.

import { resolveEnvironment } from '../registry/index.js';
import type { EnvironmentHandle, EnvLogger, ProvisionSource } from '../types/index.js';

// Defaults are env-tunable so cost vs. latency can be dialed without a redeploy.
// PREWARM_POOL_SIZE — how many warm handles to keep ready per project key.
// PREWARM_TTL_MS — how long an unclaimed warm handle lives before auto-kill.
const DEFAULT_POOL_SIZE = Math.max(0, Number(process.env.PREWARM_POOL_SIZE) || 1);
const DEFAULT_TTL_MS = Math.max(30_000, Number(process.env.PREWARM_TTL_MS) || 8 * 60_000);

// The identity a future session must match to ADOPT a warm handle. Owner is
// folded in so one user can never claim another user's warm sandbox; projectId
// is the primary workspace discriminator (the /message path always sends it),
// falling back to a source fingerprint when no projectId is supplied.
export interface PrewarmIdentity {
  ownerId?: string;
  environment: string;
  runtimeProfile?: string;
  projectId?: string;
  source?: ProvisionSource;
}

// What /prewarm needs to actually provision a warm handle (identity + the bits
// environment.provision() consumes).
export interface PrewarmRequest extends PrewarmIdentity {
  env?: Record<string, string>;
  ports?: number[];
}

export interface PrewarmStatus {
  key: string;
  ready: number; // warm handles ready to claim right now
  provisioning: number; // in-flight provisions (incl. ones just kicked off)
  target: number; // desired pool size for this key
}

export function prewarmKey(id: PrewarmIdentity): string {
  const workspace = id.projectId ? `proj:${id.projectId}` : sourceFingerprint(id.source);
  return [id.ownerId ?? '-', id.environment, id.runtimeProfile ?? '-', workspace].join('::');
}

function sourceFingerprint(source: ProvisionSource | undefined): string {
  if (!source) return 'none';
  switch (source.kind) {
    case 'git':
      return `git:${source.url}@${source.revision ?? 'HEAD'}`;
    case 'cache':
      return `cache:${source.ref}`;
    case 'files':
      // Warm pools target project repos (git); a files seed is caller-specific, so
      // fingerprint only by count — identical-empty seeds share a key.
      return `files:${source.files.length}`;
  }
}

interface PoolEntry {
  handle: EnvironmentHandle;
  ttlTimer: ReturnType<typeof setTimeout>;
}

export class PrewarmPool {
  private readonly ready = new Map<string, PoolEntry[]>();
  private readonly inflight = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly defaultTarget: number;

  constructor(opts: { ttlMs?: number; defaultTarget?: number } = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.defaultTarget = opts.defaultTarget ?? DEFAULT_POOL_SIZE;
  }

  // Top the warm pool for a key up toward `target`, provisioning the shortfall in
  // the BACKGROUND. Returns immediately — the project-open request never blocks on
  // a cold start. Best-effort: a failed provision just leaves the slot empty (the
  // /message path re-provisions and surfaces errors as it always did).
  ensure(req: PrewarmRequest, target = this.defaultTarget, logger?: EnvLogger): PrewarmStatus {
    const key = prewarmKey(req);
    const have = this.ready.get(key)?.length ?? 0;
    const pending = this.inflight.get(key) ?? 0;
    const want = Math.max(0, target - have - pending);
    for (let i = 0; i < want; i++) void this.provisionOne(key, req, logger);
    return { key, ready: have, provisioning: pending + want, target };
  }

  private async provisionOne(key: string, req: PrewarmRequest, logger?: EnvLogger): Promise<void> {
    this.inflight.set(key, (this.inflight.get(key) ?? 0) + 1);
    try {
      const environment = resolveEnvironment(req.environment);
      const handle = await environment.provision({
        source: req.source ?? { kind: 'files', files: [] },
        runtimeProfile: req.runtimeProfile,
        env: req.env,
        ports: req.ports,
        labels: { prewarm: 'true', ...(req.projectId ? { projectId: req.projectId } : {}) },
        logger,
      });
      const ttlTimer = setTimeout(() => void this.evict(key, handle), this.ttlMs);
      // Never let a warm-but-idle handle keep the process alive.
      if (typeof ttlTimer.unref === 'function') ttlTimer.unref();
      const list = this.ready.get(key) ?? [];
      list.push({ handle, ttlTimer });
      this.ready.set(key, list);
      logger?.('info', `prewarm ready (+1) for ${key}`);
    } catch (err) {
      logger?.('warn', `prewarm provision failed for ${key}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.inflight.set(key, Math.max(0, (this.inflight.get(key) ?? 1) - 1));
    }
  }

  // Claim a ready warm handle for an identity, cancelling its TTL. Returns
  // undefined on a pool miss — the caller then provisions fresh exactly as before.
  claim(id: PrewarmIdentity): EnvironmentHandle | undefined {
    const key = prewarmKey(id);
    const list = this.ready.get(key);
    if (!list || list.length === 0) return undefined;
    const entry = list.shift()!;
    clearTimeout(entry.ttlTimer);
    if (list.length === 0) this.ready.delete(key);
    return entry.handle;
  }

  stats(): PrewarmStatus[] {
    const out: PrewarmStatus[] = [];
    const keys = new Set<string>([...this.ready.keys(), ...this.inflight.keys()]);
    for (const key of keys) {
      out.push({
        key,
        ready: this.ready.get(key)?.length ?? 0,
        provisioning: this.inflight.get(key) ?? 0,
        target: this.defaultTarget,
      });
    }
    return out;
  }

  // TTL reaper for a single unclaimed handle.
  private async evict(key: string, handle: EnvironmentHandle): Promise<void> {
    const list = this.ready.get(key);
    if (list) {
      const idx = list.findIndex((e) => e.handle === handle);
      if (idx >= 0) {
        clearTimeout(list[idx]!.ttlTimer);
        list.splice(idx, 1);
        if (list.length === 0) this.ready.delete(key);
      }
    }
    await handle.destroy().catch(() => {});
  }

  // Tear down every warm handle (process shutdown / test cleanup).
  async destroyAll(): Promise<void> {
    const entries = [...this.ready.values()].flat();
    this.ready.clear();
    this.inflight.clear();
    await Promise.all(
      entries.map((e) => {
        clearTimeout(e.ttlTimer);
        return e.handle.destroy().catch(() => {});
      })
    );
  }
}
