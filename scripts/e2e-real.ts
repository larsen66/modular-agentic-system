// scripts/e2e-real.ts
// The 100% NO-MOCK end-to-end proof for the two-seam kernel's CLOUD path:
//   harness "openai-agents" (real OpenAI-wire agent loop, driven by a REAL model
//     through OpenRouter — OPENAI_BASE_URL=https://openrouter.ai/api/v1)
//   × environment "e2b" and (repeat) "daytona"  — real provider sandboxes.
//
// The real model drives the tool loop (write_file / run_command / read_file /
// expose_port). The tools route OUT to a REAL cloud sandbox: real files, real
// `npm install`, real Vite dev server, real public preview URL. We assert the
// preview serves HTTP 200 and the body is the REAL generated app (Vite client
// markup), then tear the sandbox down.
//
// PROOF-OF-REAL captured per leg: provider sandboxId, OpenRouter model id +
// prompt/completion tokens + billed cost (queried from OpenRouter's
// /generation endpoint — a non-zero cost is a real billed call, impossible to
// fake from a localhost mock), the preview URL, the HTTP status, and a ~300-char
// HTML snippet.
//
// Sibling to the harness/environment verification scripts. This
// one exercises the CLOUD envs (e2b, daytona) + the real OpenRouter model.
//
// KEYS: sourced from ../.harness.env (E2B, Daytona, …). The model key is
// OPENROUTER_API_KEY. If it is absent the LIVE-MODEL leg is SKIPPED LOUDLY —
// no mock is ever substituted as the result (that would defeat the proof).
//
// Run: npx tsx scripts/e2e-real.ts
//      (or: npm run e2e:real once package.json wires it — not added here.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// .harness.env lives at the repo root (4 levels up from this build dir), per the
// teammate brief: /Users/.../vbp-german/.harness.env
const REPO_ROOT = path.resolve(ROOT, '..', '..', '..', '..');
const HARNESS_ENV = path.join(REPO_ROOT, '.harness.env');

// ── .harness.env loader (dotenv-style, no dependency) ──────────────────────────
function loadHarnessEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(HARNESS_ENV)) {
    console.log(`[e2e:real] WARNING: ${HARNESS_ENV} not found.`);
    return out;
  }
  const raw = fs.readFileSync(HARNESS_ENV, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// The .harness.env keys use friendly names (E2B, Daytona). Map them onto the env
// var names the adapters/SDKs actually read.
function applyKeys(harnessEnv: Record<string, string>): void {
  const map: Record<string, string> = {
    E2B: 'E2B_API_KEY',
    Daytona: 'DAYTONA_API_KEY',
    CSB_API_KEY: 'CSB_API_KEY',
  };
  for (const [friendly, target] of Object.entries(map)) {
    if (harnessEnv[friendly] && !process.env[target]) process.env[target] = harnessEnv[friendly];
  }
  // Already-correct names pass through verbatim.
  for (const [k, v] of Object.entries(harnessEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }

  // The model goes through OpenRouter (OpenAI-compatible). Wire the openai-agents
  // harness to it: OPENAI_BASE_URL + OPENAI_API_KEY=$OPENROUTER_API_KEY.
  const orKey =
    harnessEnv.OPENROUTER_API_KEY || harnessEnv.OPENROUTER || process.env.OPENROUTER_API_KEY || '';
  if (orKey) {
    process.env.OPENROUTER_API_KEY = orKey;
    process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    process.env.OPENAI_API_KEY = orKey;
    // A cheap model keeps the billed cost tiny while still being a real call.
    process.env.OPENAI_AGENTS_MODEL =
      process.env.OPENAI_AGENTS_MODEL || 'openai/gpt-4o-mini';
  }
}

// ── tiny fetch helpers ─────────────────────────────────────────────────────────
async function httpGet(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 12_000
): Promise<{ status: number; body: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ac.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// Query OpenRouter for the REAL billed cost of a generation id. This is the
// anti-fake linchpin: a non-zero `total_cost` returned by OpenRouter's own
// accounting cannot be produced by a localhost mock.
async function fetchOpenRouterCost(
  generationId: string
): Promise<{ cost: number; model: string; tokensPrompt: number; tokensCompletion: number } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !generationId) return null;
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      data?: {
        total_cost?: number;
        model?: string;
        tokens_prompt?: number;
        tokens_completion?: number;
      };
    };
    const d = j.data;
    if (!d) return null;
    return {
      cost: d.total_cost ?? 0,
      model: d.model ?? '',
      tokensPrompt: d.tokens_prompt ?? 0,
      tokensCompletion: d.tokens_completion ?? 0,
    };
  } catch {
    return null;
  }
}

interface LegResult {
  env: string;
  status: 'PASS' | 'SKIP' | 'FAIL';
  sandboxId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  previewUrl?: string;
  httpStatus?: number;
  htmlSnippet?: string;
  detail?: string;
}

const APP_MARKERS = ['/@vite/', '/@react-refresh', 'type="module"', 'id="root"', 'vite'];
function looksLikeRealApp(body: string): boolean {
  const lower = body.toLowerCase();
  return APP_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

// ── one cloud leg: real model × real <env> ─────────────────────────────────────
async function runLeg(envRef: 'e2b' | 'daytona'): Promise<LegResult> {
  const leg: LegResult = { env: envRef, status: 'FAIL' };

  // Provision the env adapter DIRECTLY (not via the kernel). Two reasons:
  //  1. We need the sandboxId to print as proof — the kernel keeps the handle id
  //     opaque and never surfaces it to the caller.
  //  2. The private-sandbox preview TOKEN (e2b traffic token / daytona preview
  //     token) is dropped by the kernel's `preview_ready` event (it carries only
  //     {url, port}). To fetch the private preview over HTTP we need the token,
  //     which only the adapter holds. The model still drives the REAL build via
  //     the harness against THIS SAME handle — nothing is mocked.
  const { resolveEnvironment } = await import('../src/registry/index.js');
  const { resolveHarness } = await import('../src/registry/index.js');
  await import(`../src/environments/${envRef}/index.js`);
  await import('../src/harnesses/openai-agents/index.js');

  const log = (level: string, message: string) => console.log(`    [${envRef}:${level}] ${message}`);

  console.log(`\n[e2e:real] ── leg: openai-agents × ${envRef} ──────────────────────────`);
  const environment = resolveEnvironment(envRef);
  const handle = await environment.provision({
    source: { kind: 'files', files: [] },
    runtimeProfile: undefined, // adapter default template (node/npm/Vite present)
    logger: log as never,
  });
  leg.sandboxId = handle.id;
  console.log(`[e2e:real] provisioned ${envRef} sandbox: ${handle.id}`);

  // Capture the model's generation id from the OpenRouter response so we can
  // query the real billed cost afterward. We sniff it off the wire by wrapping
  // global fetch for the duration of the run.
  let lastGenerationId = '';
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const res = await realFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (url.includes('/chat/completions')) {
        const clone = res.clone();
        const j: any = await clone.json().catch(() => null);
        if (j?.id) lastGenerationId = j.id;
      }
    } catch {
      /* sniff is best-effort */
    }
    return res;
  }) as typeof fetch;

  const harness = resolveHarness('openai-agents');
  const events: any[] = [];
  let previewUrl: string | null = null;
  let inTok = 0;
  let outTok = 0;
  let terminalCause = '';
  const controller = new AbortController();

  const io = {
    emit: (ev: any) => {
      events.push(ev);
      if (ev.type === 'stream_chunk') process.stdout.write(ev.text);
      else if (ev.type === 'tool_call')
        console.log(`\n  → tool_call: ${ev.name}(${JSON.stringify(ev.args).slice(0, 100)})`);
      else if (ev.type === 'tool_result')
        console.log(`  ← tool_result ok=${ev.ok}: ${(ev.output ?? '').slice(0, 100)}`);
      else if (ev.type === 'preview_ready') {
        previewUrl = ev.url;
        console.log(`\n  ★ preview_ready: ${ev.url}`);
      } else if (ev.type === 'usage_delta') {
        inTok += ev.inputTokens ?? 0;
        outTok += ev.outputTokens ?? 0;
      } else if (ev.type === 'log')
        console.log(`  · ${ev.category}/${ev.level}: ${ev.message}`);
      else if (ev.type === 'terminal') {
        terminalCause = ev.cause;
        console.log(`\n  ■ terminal: ${ev.cause}${ev.error ? ' — ' + ev.error.message : ''}`);
      }
    },
  };

  try {
    await harness.run(
      {
        runId: randomUUID(),
        prompt: 'build me a todo app with React + Vite',
        model: process.env.OPENAI_AGENTS_MODEL,
        topology: harness.capabilities.defaultTopology,
        signal: controller.signal,
      },
      handle,
      io as never
    );
    leg.inputTokens = inTok;
    leg.outputTokens = outTok;
    leg.model = process.env.OPENAI_AGENTS_MODEL;

    // Real billed cost from OpenRouter's own accounting.
    const orMeta = await fetchOpenRouterCost(lastGenerationId);
    if (orMeta) {
      leg.cost = orMeta.cost;
      if (orMeta.model) leg.model = orMeta.model;
      if (!leg.inputTokens) leg.inputTokens = orMeta.tokensPrompt;
      if (!leg.outputTokens) leg.outputTokens = orMeta.tokensCompletion;
    }

    // Verify the preview actually serves the real generated app. Use the adapter
    // directly to also obtain the private-sandbox token (which the kernel event
    // dropped). We re-expose the port the model exposed (default 5173).
    if (previewUrl) {
      const port = events.find((e) => e.type === 'preview_ready')?.port ?? 5173;
      const exposed = await handle.exposePort(port);
      const headers: Record<string, string> = {};
      if (exposed.token) {
        // e2b uses `e2b-traffic-access-token`; daytona uses `x-daytona-preview-token`.
        if (envRef === 'e2b') headers['e2b-traffic-access-token'] = exposed.token;
        else {
          headers['x-daytona-preview-token'] = exposed.token;
          headers['X-Daytona-Skip-Preview-Warning'] = 'true';
        }
      }
      let res: { status: number; body: string } | undefined;
      for (let i = 0; i < 12; i++) {
        try {
          res = await httpGet(exposed.url, headers);
          if (res.status === 200) break;
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      leg.previewUrl = exposed.url;
      leg.httpStatus = res?.status;
      leg.htmlSnippet = (res?.body ?? '').slice(0, 300);
      const ok200 = res?.status === 200;
      const realApp = looksLikeRealApp(res?.body ?? '');
      if (ok200 && realApp && terminalCause === 'done') {
        leg.status = 'PASS';
      } else {
        leg.status = 'FAIL';
        leg.detail = `http=${res?.status} realApp=${realApp} terminal=${terminalCause}`;
      }
    } else {
      leg.status = 'FAIL';
      leg.detail = `no preview_ready emitted (terminal=${terminalCause})`;
    }
  } finally {
    globalThis.fetch = realFetch;
    await handle.destroy().catch(() => {});
    console.log(`[e2e:real] ${envRef} sandbox torn down.`);
  }

  return leg;
}

// ── main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const harnessEnv = loadHarnessEnv();
  applyKeys(harnessEnv);

  const hasModelKey = !!process.env.OPENROUTER_API_KEY;
  const hasE2b = !!process.env.E2B_API_KEY;
  const hasDaytona = !!process.env.DAYTONA_API_KEY;

  console.log('========================= e2e:real preflight =========================');
  console.log(`OPENROUTER_API_KEY (live model):  ${hasModelKey ? 'present ✓' : 'ABSENT ✗'}`);
  console.log(`E2B_API_KEY:                      ${hasE2b ? 'present ✓' : 'absent ✗'}`);
  console.log(`DAYTONA_API_KEY:                  ${hasDaytona ? 'present ✓' : 'absent ✗'}`);
  if (hasModelKey) {
    console.log(`OPENAI_BASE_URL:                  ${process.env.OPENAI_BASE_URL}`);
    console.log(`model:                            ${process.env.OPENAI_AGENTS_MODEL}`);
  }
  console.log('======================================================================');

  const results: LegResult[] = [];

  if (!hasModelKey) {
    // The brief is explicit: do everything EXCEPT the live-model leg and print a
    // LOUD SKIP. We never substitute a mock as the result — a mock-driven "pass"
    // would be a lie about what was proven.
    console.log('\n' + '!'.repeat(72));
    console.log('!! LIVE-MODEL LEG SKIPPED — OPENROUTER_API_KEY is not present in');
    console.log(`!! ${HARNESS_ENV}`);
    console.log('!! The openai-agents harness needs a real model to drive the tool loop.');
    console.log('!! NO MOCK was substituted — this leg is UNPROVEN, not faked.');
    console.log('!! To run it live: add OPENROUTER_API_KEY=sk-or-... to .harness.env and rerun.');
    console.log('!'.repeat(72) + '\n');
    for (const env of ['e2b', 'daytona']) {
      results.push({ env, status: 'SKIP', detail: 'OPENROUTER_API_KEY absent — model leg cannot run' });
    }
  } else {
    if (hasE2b) results.push(await runLeg('e2b'));
    else results.push({ env: 'e2b', status: 'SKIP', detail: 'E2B_API_KEY absent' });

    if (hasDaytona) results.push(await runLeg('daytona'));
    else results.push({ env: 'daytona', status: 'SKIP', detail: 'DAYTONA_API_KEY absent' });
  }

  // ── final report ──────────────────────────────────────────────────────────
  console.log('\n========================= e2e:real REPORT =========================');
  for (const r of results) {
    console.log(`\n── ${r.env} : ${r.status} ──`);
    if (r.sandboxId) console.log(`  sandboxId:    ${r.sandboxId}`);
    if (r.model) console.log(`  model:        ${r.model}`);
    if (r.inputTokens != null) console.log(`  tokens:       in=${r.inputTokens} out=${r.outputTokens}`);
    if (r.cost != null) console.log(`  BILLED COST:  $${r.cost}  ${r.cost > 0 ? '(real billed call ✓)' : '(zero — verify on dashboard)'}`);
    if (r.previewUrl) console.log(`  previewUrl:   ${r.previewUrl}`);
    if (r.httpStatus != null) console.log(`  HTTP status:  ${r.httpStatus}`);
    if (r.htmlSnippet) console.log(`  HTML[0:300]:  ${JSON.stringify(r.htmlSnippet)}`);
    if (r.detail) console.log(`  detail:       ${r.detail}`);
  }
  console.log('\n===================================================================');

  const anyReal = results.some((r) => r.status === 'PASS');
  const anyFail = results.some((r) => r.status === 'FAIL');
  if (!hasModelKey) {
    console.log('VERDICT: live-model leg UNPROVEN (OPENROUTER_API_KEY missing). No mocks substituted.');
    process.exit(2); // distinct code: skipped, not failed, not fully passed
  } else if (anyFail) {
    console.log('VERDICT: at least one leg FAILED — see detail above.');
    process.exit(1);
  } else if (anyReal) {
    console.log('VERDICT: no mocks — all attempted legs real (real model tokens, real sandbox, real preview).');
    process.exit(0);
  } else {
    console.log('VERDICT: no legs ran (all skipped).');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[e2e:real] FATAL:', err);
  process.exit(1);
});
