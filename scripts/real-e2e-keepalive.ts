// scripts/real-e2e-keepalive.ts
// Same real path as real-e2e.ts, but it does NOT destroy the session/container
// at the end and it keeps the HTTP server's preview proxy alive — so an external
// verifier (curl / browser) can hit the live preview URL. It writes the URL to
// .e2e-preview-url and the generated index HTML to docs-evidence/preview-served.html,
// then keeps the proxy process alive until SIGINT.

import http from 'node:http';
import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Kernel } from '../src/kernel/index.js';
import type { EngineEvent } from '../src/types/index.js';
import '../src/harnesses/sdk/index.js';
import '../src/environments/docker/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const MOCK_PORT = 8788;

function httpGet(url: string, timeoutMs = 8000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

async function main() {
  const hasRealKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  let mockProc: ChildProcess | undefined;
  if (!hasRealKey) {
    mockProc = spawn('npx', ['tsx', path.join(HERE, 'mock-llm.ts')], {
      env: { ...process.env, MOCK_LLM_PORT: String(MOCK_PORT) },
      stdio: 'inherit',
    });
    process.env.ANTHROPIC_BASE_URL = `http://localhost:${MOCK_PORT}`;
    await new Promise((r) => setTimeout(r, 1500));
  }

  const kernel = new Kernel();
  let previewUrl: string | null = null;
  const handle = kernel.runMessage(
    {
      sessionId: 'e2e-keepalive',
      harness: 'sdk',
      environment: 'docker',
      source: { kind: 'files', files: [] },
      runtimeProfile: 'node:20-slim',
      ports: [5173],
    },
    'Build me a todo app',
    (ev: EngineEvent) => {
      if (ev.type === 'preview_ready') previewUrl = ev.url;
      if (ev.type === 'tool_call') console.log(`tool_call ${ev.name}`);
    }
  );

  const result = await handle.result;
  console.log('settlement:', result.cause);

  if (previewUrl) {
    const r = await httpGet(previewUrl).catch(() => ({ status: 0, body: '' }));
    fs.writeFileSync(path.join(ROOT, '.e2e-preview-url'), previewUrl);
    fs.writeFileSync(path.join(ROOT, 'docs-evidence', 'preview-served.html'), r.body);
    console.log(`PREVIEW_URL=${previewUrl}`);
    console.log(`PREVIEW_STATUS=${r.status}`);
    console.log(`PREVIEW_HTML_BYTES=${r.body.length}`);
    console.log('KEEPALIVE: container + proxy held open. Ctrl-C to tear down.');
  } else {
    console.log('NO PREVIEW URL — run did not reach expose_port.');
    mockProc?.kill();
    process.exit(1);
  }

  // Hold the process open so the proxy keeps serving for external verification.
  const cleanup = async () => {
    await kernel.endSession('e2e-keepalive');
    mockProc?.kill();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  setInterval(() => {}, 1 << 30); // keep event loop alive
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
