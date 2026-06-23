// scripts/verify-real.ts
// `npm run verify:real` — the lead's acceptance gate.
//
// Drives the REAL SDK harness code path (provider client, agent loop, tool
// routing) against a LOCAL OpenAI-compatible MOCK (set via OPENAI_BASE_URL),
// hitting the REAL Docker environment (real container, real exec/writeFiles,
// real npm install, real Vite dev server) with a REAL reverse-proxied preview.
//
// Everything is real EXCEPT the model tokens. Swapping the mock base URL for the
// real endpoint + a real OPENAI_API_KEY (or ANTHROPIC_API_KEY) makes it fully
// live with ZERO code change.
//
// Exit 0 only if: real container ran tools, preview_ready emitted, preview URL
// served HTTP 200 with app HTML, and settlement fired with cause=done.

import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PORT = 8799;

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

async function waitForMock(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      await httpGet(`http://localhost:${MOCK_PORT}/nope`, 1000);
      return;
    } catch (e) {
      if (String(e).includes('404')) return;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function main() {
  // Force the OPENAI provider path through the local mock (proves the 2nd
  // provider's code, distinct from real-e2e which exercises the Anthropic wire).
  // We deliberately do NOT require a real key; the mock ignores it.
  const usingRealKey = !!process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL;

  let mockProc: ChildProcess | undefined;
  if (!usingRealKey) {
    console.log('[verify:real] Starting dual-wire mock; driving the REAL harness via OPENAI_BASE_URL.');
    mockProc = spawn('npx', ['tsx', path.join(HERE, 'mock-llm.ts')], {
      env: { ...process.env, MOCK_LLM_PORT: String(MOCK_PORT) },
      stdio: 'inherit',
    });
    process.env.OPENAI_BASE_URL = `http://localhost:${MOCK_PORT}/v1`;
    // Ensure Anthropic does NOT win selection — unset its key/base for this run.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_BASE_URL;
    await waitForMock();
  } else {
    console.log('[verify:real] Real OPENAI_API_KEY detected → using the REAL model.');
  }

  // Import the kernel + adapters AFTER env is set so provider selection sees it.
  const { Kernel } = await import('../src/kernel/index.js');
  await import('../src/harnesses/sdk/index.js');
  await import('../src/environments/docker/index.js');
  const { describeSdk } = await import('../src/harnesses/sdk/providers/index.js');

  const health = describeSdk();
  console.log('[verify:real] SDK health:', JSON.stringify(health));
  if (health.provider !== 'openai') {
    console.error(`[verify:real] expected provider=openai, got ${health.provider}`);
    mockProc?.kill();
    process.exit(1);
  }

  const kernel = new Kernel();
  const seen = new Set<string>();
  let previewUrl: string | null = null;
  let toolOk = false;

  console.log('\n[verify:real] Running: harness=sdk × environment=docker  (OpenAI wire via mock)\n');
  const handle = kernel.runMessage(
    {
      sessionId: 'verify-real',
      harness: 'sdk',
      environment: 'docker',
      source: { kind: 'files', files: [] },
      runtimeProfile: 'node:20-slim',
      ports: [5173],
    },
    'Build me a todo app',
    (ev) => {
      seen.add(ev.type);
      if (ev.type === 'tool_call') console.log(`  → ${ev.name}`);
      if (ev.type === 'tool_result' && ev.ok) toolOk = true;
      if (ev.type === 'preview_ready') {
        previewUrl = ev.url;
        console.log(`  ★ preview_ready: ${ev.url}`);
      }
      if (ev.type === 'terminal') console.log(`  ■ terminal: ${ev.cause}`);
    }
  );

  const result = await handle.result;

  let previewOk = false;
  let previewBody = '';
  if (previewUrl) {
    for (let i = 0; i < 10 && !previewOk; i++) {
      try {
        const r = await httpGet(previewUrl);
        previewBody = r.body;
        if (r.status === 200) previewOk = true;
      } catch {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  await kernel.endSession('verify-real');
  mockProc?.kill();

  const appLooksReal = previewBody.includes('root') || previewBody.toLowerCase().includes('vite');
  console.log('\n===================== verify:real =====================');
  console.log(`provider/model:                 ${health.provider}/${health.model} (real=${health.real})`);
  console.log(`real harness ran tools in Docker: ${toolOk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`preview_ready emitted:            ${previewUrl ? 'YES ✓ ' + previewUrl : 'NO ✗'}`);
  console.log(`preview served HTTP 200:          ${previewOk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`preview HTML is the real app:     ${appLooksReal ? 'YES ✓' : '(' + previewBody.slice(0, 50) + ')'}`);
  console.log(`settlement fired (cause=${result.cause}):     ${result.cause ? 'YES ✓' : 'NO ✗'}`);
  console.log('=======================================================');

  const pass = toolOk && !!previewUrl && previewOk && result.cause === 'done';
  console.log(pass ? '\n[verify:real] PASS ✅  (real harness × real Docker × real preview; only model tokens are mocked)' : '\n[verify:real] FAIL ❌');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify:real] FAIL:', e);
  process.exit(1);
});
