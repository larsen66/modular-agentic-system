// End-to-end serve path for the durable preview snapshot, exercising the REAL
// server + kernel + tool + store. Only the SUBSTRATE is faked: a fake env whose
// readFile returns a real gzipped tarball (the same bytes `tar czf` would
// produce inside a sandbox), so the whole chain is proven —
//   harness → snapshot_preview tool → store.ingestTarball → preview_snapshot_ready
//   → orchestrator pump → PreviewRegistry → kernel.readPreviewFile → HTTP route.

import { describe, it, expect, beforeAll } from 'vitest';
import { gzipSync } from 'node:zlib';
import { pack as tarPack } from 'tar-stream';
import {
  registerEnvironment,
  registerHarness,
  buildKit,
} from '../src/registry/index.js';
import { Kernel } from '../src/kernel/index.js';
import { buildServer } from '../src/server/http.js';
// Side-effect imports: register the canonical tool + skill set (the orchestrator
// resolves the default builder kit before invoking the harness).
import '../src/tools/index.js';
import '../src/skills/index.js';
import type {
  Environment,
  EnvironmentHandle,
  Harness,
  RunIO,
  RunTask,
} from '../src/types/index.js';

const INDEX_HTML = '<!doctype html><html><body><h1>hello snapshot</h1><script src="./assets/app.js"></script></body></html>';

function makeTarball(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = tarPack();
    const chunks: Buffer[] = [];
    p.on('data', (c: Buffer) => chunks.push(c));
    p.on('end', () => resolve(gzipSync(Buffer.concat(chunks))));
    p.on('error', reject);
    p.entry({ name: './index.html' }, INDEX_HTML);
    p.entry({ name: './assets/app.js' }, 'console.log("ok")');
    p.finalize();
  });
}

let tarball: Buffer;

// A fake env that simulates a workspace already containing a built dist/. The
// tool reads dist/index.html (guard), execs `tar` (we report success), then
// reads the archive — which we return as a real gzipped tarball.
function fakeHandle(): EnvironmentHandle {
  return {
    id: 'fake-snap-handle',
    capabilities: {
      publicPorts: true,
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
    async readFile(p: string) {
      if (p.endsWith('dist/index.html')) return Buffer.from(INDEX_HTML);
      if (p.includes('__kernel_snapshot.tgz')) return tarball;
      return null;
    },
    async exposePort() {
      return { url: 'http://unused' };
    },
    async destroy() {},
  };
}

const fakeEnv: Environment = {
  ref: 'fake-snap-env',
  capabilities: {
    publicPorts: true,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: false,
  },
  async provision() {
    return fakeHandle();
  },
};

// A fake harness that runs the REAL snapshot_preview tool resolved from the
// registry, then settles. agent-as-tool so the tool gets the env handle.
const fakeHarness: Harness = {
  ref: 'fake-snap-harness',
  capabilities: {
    topologies: ['agent-as-tool'],
    defaultTopology: 'agent-as-tool',
  },
  async run(_task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    const kit = buildKit(['snapshot_preview'], [], [], []);
    const tool = kit.byRef('snapshot_preview');
    if (!tool) throw new Error('snapshot_preview tool not registered');
    const result = await tool.execute({ dir: 'dist' }, env, io);
    io.emit({ type: 'final_text', text: result.content });
    io.emit({ type: 'terminal', cause: result.isError ? 'error' : 'done' });
  },
};

beforeAll(async () => {
  tarball = await makeTarball();
  process.env.DEV_NO_AUTH = '1';
  registerEnvironment('fake-snap-env', () => fakeEnv);
  registerHarness('fake-snap-harness', () => fakeHarness);
});

describe('durable preview snapshot — full serve path', () => {
  it('captures a snapshot during a run and serves it over HTTP after', async () => {
    // /message streams raw SSE (reply.raw) which app.inject can't drive — use a
    // real listening server + fetch so the stream completes on reply.raw.end().
    const app = buildServer(new Kernel());
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') throw new Error('no server address');
    const base = `http://127.0.0.1:${addr.port}`;
    const sessionId = 'snap-session-1';

    try {
      // 1) Run a message that triggers snapshot_preview. Reading the body to end
      // waits for settlement (reply.raw.end()).
      const run = await fetch(`${base}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          harness: 'fake-snap-harness',
          environment: 'fake-snap-env',
          prompt: 'snapshot it',
          sessionId,
        }),
      });
      expect(run.status).toBe(200);
      const sse = await run.text();
      expect(sse).toContain('preview_snapshot_ready');
      expect(sse).toMatch(/"cause":"done"/);

      // 2) /preview/:id now advertises a durable static URL.
      const meta = await (await fetch(`${base}/preview/${sessionId}`)).json();
      expect(meta.static).toMatch(new RegExp(`/preview/${sessionId}/app/$`));

      // 3) The static root serves the built index.html bytes — no live sandbox.
      const index = await fetch(`${base}/preview/${sessionId}/app/`);
      expect(index.status).toBe(200);
      expect(index.headers.get('content-type')).toContain('text/html');
      expect(await index.text()).toContain('hello snapshot');

      // 4) A nested asset resolves with the right content type.
      const asset = await fetch(`${base}/preview/${sessionId}/app/assets/app.js`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toContain('javascript');
      expect(await asset.text()).toContain('console.log');

      // 5) A missing file under a valid snapshot 404s (no existence leak).
      expect((await fetch(`${base}/preview/${sessionId}/app/nope.js`)).status).toBe(404);
    } finally {
      await app.close();
    }
  });
});
