// test/docker.test.ts
// Real Docker adapter test — SELF-SKIPPING when Docker is unavailable so the
// default suite stays green everywhere. When Docker is up, it proves the env
// axis is genuinely real behind the same opaque handle: exec returns real
// stdout, file IO round-trips, and exposePort yields a reachable URL.

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { resolveEnvironment } from '../src/registry/index.js';
import { isProcessHandle, type EnvironmentHandle } from '../src/types/index.js';
import '../src/environments/docker/index.js';

function dockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
  });
}

const HAS_DOCKER = dockerAvailable();
const d = HAS_DOCKER ? describe : describe.skip;

d('Docker environment adapter (real container)', () => {
  let handle: EnvironmentHandle;

  beforeAll(async () => {
    const env = resolveEnvironment('docker');
    handle = await env.provision({
      source: { kind: 'files', files: [{ path: 'hello.txt', content: 'hi-docker' }] },
      runtimeProfile: 'node:20-alpine',
      ports: [3000],
    });
  }, 120_000);

  it('exec runs a real command and returns real stdout', async () => {
    const r = await handle.exec('echo from-container && node --version');
    expect(isProcessHandle(r)).toBe(false);
    if (!isProcessHandle(r)) {
      expect(r.stdout).toContain('from-container');
      expect(r.stdout).toMatch(/v\d+\./);
      expect(r.exitCode).toBe(0);
    }
  });

  it('writeFiles + readFile round-trip through tar', async () => {
    await handle.writeFiles([{ path: 'written.txt', content: 'round-trip-ok' }]);
    const buf = await handle.readFile('written.txt');
    expect(buf?.toString()).toBe('round-trip-ok');
  });

  it('exposePort returns a reachable URL via the reverse proxy', async () => {
    await handle.exec(
      `node -e 'require("http").createServer((q,s)=>s.end("PROXY-OK")).listen(3000,"0.0.0.0")'`,
      { detached: true }
    );
    await handle.waitForPort?.(3000, 20_000);
    const { url } = await handle.exposePort(3000);
    expect(url).toMatch(/^http:\/\/localhost:\d+\//);
    const res = await httpGet(url);
    expect(res.status).toBe(200);
    expect(res.body).toContain('PROXY-OK');
  }, 30_000);

  it('destroy tears the container down', async () => {
    await handle.destroy();
  });
});
