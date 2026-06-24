import { describe, it, expect, beforeAll } from 'vitest';
import { registerEnvironment } from '../src/registry/index.js';
import { PrewarmPool, prewarmKey } from '../src/kernel/prewarmPool.js';
import { SessionManager } from '../src/kernel/session.js';
import type { Environment, EnvironmentHandle } from '../src/types/index.js';

// A fake env that records how many handles it provisioned + which were destroyed.
// Each provision yields a distinct opaque handle (so adoption vs. fresh-provision
// is observable by identity).
let provisioned = 0;
const destroyed = new Set<string>();

function fakeHandle(): EnvironmentHandle {
  const id = `h${++provisioned}`;
  return {
    id,
    capabilities: {
      publicPorts: false,
      pty: false,
      snapshot: false,
      nativeGit: false,
      fileWatch: false,
      persistentVolume: false,
      hostsAgentRuntime: false,
    },
    async exec() {
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async writeFiles() {},
    async readFile() {
      return null;
    },
    async exposePort() {
      return { url: 'http://x' };
    },
    async destroy() {
      destroyed.add(id);
    },
  };
}

const fakeEnv: Environment = {
  ref: 'fake-prewarm',
  capabilities: {
    publicPorts: false,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: false,
  },
  async provision() {
    // Simulate a small cold start so background provisioning is observably async.
    await new Promise((r) => setTimeout(r, 5));
    return fakeHandle();
  },
};

beforeAll(() => {
  registerEnvironment('fake-prewarm', () => fakeEnv);
});

const baseReq = {
  ownerId: 'owner-1',
  environment: 'fake-prewarm',
  projectId: 'proj-A',
  source: { kind: 'git' as const, url: 'https://example.com/repo.git' },
};

describe('prewarmKey', () => {
  it('keys on projectId when present (ignores source differences)', () => {
    const a = prewarmKey({ ...baseReq });
    const b = prewarmKey({ ...baseReq, source: { kind: 'files', files: [] } });
    expect(a).toBe(b); // same project ⇒ same key regardless of source seed
  });

  it('scopes by owner — a different owner cannot collide', () => {
    expect(prewarmKey({ ...baseReq })).not.toBe(prewarmKey({ ...baseReq, ownerId: 'owner-2' }));
  });
});

describe('PrewarmPool', () => {
  it('warms toward target in the background and claim() adopts a ready handle', async () => {
    const pool = new PrewarmPool({ ttlMs: 60_000, defaultTarget: 2 });
    const status = pool.ensure(baseReq);
    expect(status.provisioning).toBe(2); // both kicked off, none ready yet
    expect(status.ready).toBe(0);

    // Let the background provisions settle.
    await new Promise((r) => setTimeout(r, 30));
    expect(pool.stats()[0]!.ready).toBe(2);

    const h1 = pool.claim(baseReq);
    const h2 = pool.claim(baseReq);
    expect(h1).toBeDefined();
    expect(h2).toBeDefined();
    expect(h1).not.toBe(h2);
    // Pool now empty ⇒ a third claim misses.
    expect(pool.claim(baseReq)).toBeUndefined();

    await pool.destroyAll();
  });

  it('auto-kills an unclaimed handle when its TTL fires', async () => {
    const pool = new PrewarmPool({ ttlMs: 20, defaultTarget: 1 });
    pool.ensure({ ...baseReq, projectId: 'proj-TTL' });
    await new Promise((r) => setTimeout(r, 15)); // provisioned, not yet expired
    const readyHandleId = pool.stats().find((s) => s.key.includes('proj-TTL'))?.ready;
    expect(readyHandleId).toBe(1);

    await new Promise((r) => setTimeout(r, 40)); // past TTL
    expect(pool.stats().find((s) => s.key.includes('proj-TTL'))?.ready ?? 0).toBe(0);
    // A claim after expiry misses, proving the handle was reaped.
    expect(pool.claim({ ...baseReq, projectId: 'proj-TTL' })).toBeUndefined();
  });

  it('SessionManager adopts a warm handle instead of provisioning fresh', async () => {
    const pool = new PrewarmPool({ ttlMs: 60_000, defaultTarget: 1 });
    pool.ensure({ ...baseReq, projectId: 'proj-ADOPT' });
    await new Promise((r) => setTimeout(r, 30));

    const provisionedBefore = provisioned;
    const sessions = new SessionManager(pool);
    const handle = await sessions.ensureWorkspace({
      sessionId: 'chat-session-1',
      ownerId: 'owner-1',
      harness: 'noop',
      environment: 'fake-prewarm',
      projectId: 'proj-ADOPT',
    });
    expect(handle).toBeDefined();
    // No NEW provision happened — the warm handle was adopted.
    expect(provisioned).toBe(provisionedBefore);

    await pool.destroyAll();
  });
});
