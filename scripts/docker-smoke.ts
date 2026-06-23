// scripts/docker-smoke.ts
// PRIORITY 3 live proof: the real Docker environment adapter behind the SAME
// opaque EnvironmentHandle. Runs only when Docker is available (checked by the
// caller). Drives the DummyHarness × Docker env to show:
//   - exec runs a real command in a real container and returns real stdout
//   - writeFiles/readFile round-trip through tar
//   - exposePort returns a reachable URL via the written-once reverse proxy
//
// This is the env-axis swap: harness "dummy" is byte-identical to the Dummy×Dummy
// run; only `environment` changed from "dummy" to "docker".

import http from 'node:http';
import { resolveEnvironment } from '../src/registry/index.js';
import { isProcessHandle } from '../src/types/index.js';
import '../src/environments/docker/index.js';

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

async function main() {
  const env = resolveEnvironment('docker');
  console.log('[docker-smoke] provisioning a real container (node:20-alpine)…');
  const handle = await env.provision({
    source: {
      kind: 'files',
      files: [
        { path: 'app/server.js', content: serverJs() },
        { path: 'app/hello.txt', content: 'hello from the container\n' },
      ],
    },
    runtimeProfile: 'node:20-alpine',
    ports: [3000],
  });
  console.log('[docker-smoke] provisioned; handle is opaque to Core. capabilities=', handle.capabilities);

  try {
    // 1) exec — real command, real stdout.
    const echo = await handle.exec('echo hi-from-docker && node --version');
    if (isProcessHandle(echo)) throw new Error('expected ExecResult');
    console.log('[docker-smoke] exec stdout:', JSON.stringify(echo.stdout));
    if (!echo.stdout.includes('hi-from-docker')) throw new Error('exec did not return expected output');

    // 2) readFile — round-trip the seeded file through tar.
    const buf = await handle.readFile('app/hello.txt');
    console.log('[docker-smoke] readFile:', JSON.stringify(buf?.toString()));
    if (!buf || !buf.toString().includes('hello from the container'))
      throw new Error('readFile round-trip failed');

    // 3) start a dev server + exposePort → reachable URL via the reverse proxy.
    console.log('[docker-smoke] starting node server in background…');
    await handle.exec('node /workspace/app/server.js', { detached: true });
    await handle.waitForPort?.(3000, 20_000);
    const { url } = await handle.exposePort(3000);
    console.log('[docker-smoke] exposePort URL:', url);

    const res = await httpGet(url);
    console.log(`[docker-smoke] GET ${url} -> ${res.status} : ${res.body.trim()}`);
    if (res.status !== 200 || !res.body.includes('MODULAR-RUNNER-OK'))
      throw new Error('preview URL was not reachable / wrong body');

    console.log('\n[docker-smoke] PASS — real container exec + file IO + reachable preview URL ✅');
  } finally {
    console.log('[docker-smoke] destroying container…');
    await handle.destroy();
  }
}

function serverJs(): string {
  return `
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MODULAR-RUNNER-OK from ' + req.url);
}).listen(3000, '0.0.0.0', () => console.log('listening on 3000'));
`;
}

main().catch((e) => {
  console.error('[docker-smoke] FAIL:', e);
  process.exit(1);
});
