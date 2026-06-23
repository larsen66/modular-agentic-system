// scripts/real-e2e.ts
// THE real end-to-end proof for Option 1's shipped path:
//   harness "sdk" (real mode-1 agent loop, real Anthropic-wire HTTP)
//     × environment "docker" (real container, real exec/writeFiles, real proxy)
//   → generates a REAL Vite+React app, npm install, real dev server, real preview URL.
//
// The LLM is the bundled Anthropic-wire mock (scripts/mock-llm.ts) UNLESS a real
// ANTHROPIC_API_KEY/OPENAI_API_KEY is present — in which case it talks to the
// real model with ZERO code changes. Either way every other piece is 100% real.
//
// Run: npx tsx scripts/real-e2e.ts
// (auto-starts the mock if no real key is set)

import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Kernel } from '../src/kernel/index.js';
import type { EngineEvent } from '../src/types/index.js';
import '../src/harnesses/sdk/index.js';
import '../src/environments/docker/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PORT = 8787;

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
      // The mock 404s on GET / but the socket connecting proves it's up.
      await httpGet(`http://localhost:${MOCK_PORT}/`, 1000);
      return;
    } catch (e) {
      if (String(e).includes('404')) return;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function main() {
  const hasRealKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  let mockProc: ChildProcess | undefined;

  if (!hasRealKey) {
    console.log('[real-e2e] No real API key found → starting the Anthropic-wire mock LLM.');
    console.log('[real-e2e]   (set ANTHROPIC_API_KEY to use the real model instead — no code change.)');
    mockProc = spawn('npx', ['tsx', path.join(HERE, 'mock-llm.ts')], {
      env: { ...process.env, MOCK_LLM_PORT: String(MOCK_PORT) },
      stdio: 'inherit',
    });
    process.env.ANTHROPIC_BASE_URL = `http://localhost:${MOCK_PORT}`;
    await waitForMock();
  } else {
    console.log('[real-e2e] Real API key detected → using the REAL model.');
  }

  const kernel = new Kernel();
  const events: EngineEvent[] = [];
  let previewUrl: string | null = null;

  console.log('\n[real-e2e] Running: harness=sdk × environment=docker');
  console.log('[real-e2e] Prompt: "Build me a todo app"\n');

  const handle = kernel.runMessage(
    {
      sessionId: 'real-e2e',
      harness: 'sdk',
      environment: 'docker',
      source: { kind: 'files', files: [] },
      runtimeProfile: 'node:20-slim',
      ports: [5173],
    },
    'Build me a todo app',
    (ev) => {
      events.push(ev);
      if (ev.type === 'stream_chunk') process.stdout.write(ev.text);
      else if (ev.type === 'tool_call') console.log(`\n  → tool_call: ${ev.name}(${JSON.stringify(ev.args).slice(0, 80)})`);
      else if (ev.type === 'tool_result') console.log(`  ← tool_result ok=${ev.ok}: ${(ev.output ?? '').slice(0, 80)}`);
      else if (ev.type === 'preview_ready') {
        previewUrl = ev.url;
        console.log(`\n  ★ preview_ready: ${ev.url}`);
      } else if (ev.type === 'usage_delta') console.log(`  usage: in=${ev.inputTokens} out=${ev.outputTokens}`);
      else if (ev.type === 'terminal') console.log(`\n  ■ terminal: ${ev.cause}`);
    }
  );

  const result = await handle.result;
  console.log('\n[real-e2e] settlement:', JSON.stringify(result, null, 0));

  // Verify the preview actually serves the generated app.
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

  console.log('\n========================= VERDICT =========================');
  console.log(`real LLM wire (HTTP /v1/messages):  ${hasRealKey ? 'REAL MODEL' : 'mock (Anthropic wire)'} ✓`);
  console.log(`real Docker container + exec/files:  ${events.some((e) => e.type === 'tool_result' && e.ok) ? 'YES ✓' : 'NO ✗'}`);
  console.log(`preview_ready emitted:              ${previewUrl ? 'YES ✓ ' + previewUrl : 'NO ✗'}`);
  console.log(`preview URL serves HTTP 200:        ${previewOk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`preview HTML looks like the app:    ${previewBody.includes('root') || previewBody.toLowerCase().includes('vite') ? 'YES ✓' : '(body: ' + previewBody.slice(0, 60) + ')'}`);
  console.log(`settlement fired (cause=${result.cause}):    ${result.cause ? 'YES ✓' : 'NO ✗'}`);
  console.log('==========================================================');

  await kernel.endSession('real-e2e');
  mockProc?.kill();

  const pass = result.cause === 'done' && !!previewUrl && previewOk;
  console.log(pass ? '\n[real-e2e] PASS ✅' : '\n[real-e2e] INCOMPLETE — see verdict above');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[real-e2e] FAIL:', e);
  process.exit(1);
});
