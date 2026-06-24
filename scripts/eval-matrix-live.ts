// scripts/eval-matrix-live.ts
// LIVE harness × environment × topology matrix eval against the DEPLOYED app
// (https://dav-version.vercel.app → VM backend). Unlike eval-web-loop.ts (which
// boots an in-process kernel against a HAND-MAINTAINED ready list), this:
//   1. fetches the LIVE catalog from GET /registry,
//   2. AUTO-ENUMERATES every COMPATIBLE (harness, env, topology) triple
//      (mirrors capabilities.ts::resolveTopology — never drifts), and
//   3. drives each triple through the real POST /message SSE surface with the
//      build-app proof prompt, verifying it actually generates + previews.
//
// Honest 3-way scoring per cell:
//   PASS      — settled done + (preview 200 & looks-like-app, when expected) + history.
//   SKIP      — couldn't exercise the combo: missing VM credential / provision /
//               auth / unsupported topology (classified from the terminal code).
//   FAIL      — the combo ran but produced a wrong/empty/broken result.
//
// Auth: set EVAL_BEARER=<jwt>, or EVAL_EMAIL + EVAL_PASSWORD (→ POST /auth/login),
// or nothing if the target has DEV_NO_AUTH.
//
// Run:
//   npx tsx scripts/eval-matrix-live.ts --dry-run            # print the matrix, no runs
//   EVAL_BEARER=… npx tsx scripts/eval-matrix-live.ts        # full live matrix
//   npx tsx scripts/eval-matrix-live.ts --only openai-agents:e2b:agent-as-tool
//   npx tsx scripts/eval-matrix-live.ts --harness openai-agents,pi --max 6 --loops 2

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineEvent } from '../src/types/index.js';
import {
  fetchRegistry,
  enumerateCompatibleTriples,
  tripleKey,
  resolveAuthHeader,
  readSse,
  engineEventsOf,
  eventCounts,
  classifyTerminal,
  httpText,
  bodyLooksLikeApp,
  verifyHistory,
  type Triple,
} from './lib/evalHttp.js';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const getArg = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

const BASE = getArg('base', process.env.EVAL_BASE_URL ?? 'https://dav-version.vercel.app').replace(/\/$/, '');
const DRY_RUN = has('--dry-run');
const LOOPS = Math.max(1, parseInt(getArg('loops', '1'), 10));
const MAX = parseInt(getArg('max', '0'), 10); // 0 = no cap
const CELL_TIMEOUT_MS = parseInt(getArg('cell-timeout-ms', String(8 * 60 * 1000)), 10);
const ONLY = new Set(csv(getArg('only', '')));
const HARNESS_FILTER = new Set(csv(getArg('harness', '')));
const ENV_FILTER = new Set(csv(getArg('env', '')));
const TOPO_FILTER = new Set(csv(getArg('topology', '')));

const PROMPT =
  'Build a tiny Vite React app named Matrix Cell Proof. Include the exact text ' +
  '"matrix-cell-proof" visibly in the page, then start the dev server and expose it.';
const MARKER = 'matrix-cell-proof';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(ROOT, 'docs-evidence');
const REPORT_PATH = path.join(OUT_DIR, 'live-matrix-report.json');
const EVENTS_PATH = path.join(OUT_DIR, 'live-matrix-events.jsonl');

// ─── Result model ─────────────────────────────────────────────────────────────
type CellStatus = 'PASS' | 'FAIL' | 'SKIP';
interface CellResult extends Triple {
  status: CellStatus;
  reason?: string;
  loop: number;
  runId?: string;
  sessionId: string;
  settledCause?: string;
  previewUrl?: string;
  previewStatus?: number;
  previewLooksLikeApp?: boolean;
  historyListed?: boolean;
  historyDetailOk?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  durationMs: number;
  eventCounts?: Record<string, number>;
  error?: string;
}

// agent-in-sandbox is the topology that runs a persistent dev server + preview.
// agent-as-tool here builds once; we still try the preview but don't hard-require it.
const expectPreview = (t: Triple): boolean => t.topology === 'agent-in-sandbox';

function selected(t: Triple): boolean {
  if (ONLY.size && !ONLY.has(tripleKey(t))) return false;
  if (HARNESS_FILTER.size && !HARNESS_FILTER.has(t.harness)) return false;
  if (ENV_FILTER.size && !ENV_FILTER.has(t.environment)) return false;
  if (TOPO_FILTER.size && !TOPO_FILTER.has(t.topology)) return false;
  return true;
}

async function runCell(t: Triple, loop: number, authHeader: string | null): Promise<CellResult> {
  const started = Date.now();
  const sessionId = `livemx-${t.harness}-${t.environment}-${t.topology}-${loop}-${started}`;
  const label = tripleKey(t);
  const result: CellResult = { ...t, status: 'FAIL', loop, sessionId, durationMs: 0 };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CELL_TIMEOUT_MS);
  let frames: Awaited<ReturnType<typeof readSse>> = [];
  try {
    console.log(`\n[matrix] RUN ${label} (loop ${loop + 1}/${LOOPS})`);
    const res = await fetch(`${BASE}/message`, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'content-type': 'application/json', ...(authHeader ? { authorization: authHeader } : {}) },
      body: JSON.stringify({
        harness: t.harness,
        environment: t.environment,
        topology: t.topology,
        sessionId,
        prompt: PROMPT,
        ports: [5173],
        source: { kind: 'files', files: [] },
      }),
    });
    if (res.status === 401 || res.status === 403) {
      result.status = 'SKIP';
      result.reason = `auth ${res.status} — set EVAL_BEARER or EVAL_EMAIL/EVAL_PASSWORD`;
      return result;
    }
    if (!res.ok || !res.body) throw new Error(`POST /message → ${res.status}`);

    frames = await readSse(res);
    result.eventCounts = eventCounts(frames);

    const runStarted = frames.find((f) => f.name === 'run_started')?.data as { runId?: string } | undefined;
    result.runId = runStarted?.runId;

    const engine = engineEventsOf(frames);
    const preview = engine.find((e) => e.type === 'preview_ready') as
      | Extract<EngineEvent, { type: 'preview_ready' }>
      | undefined;
    result.previewUrl = preview?.url;

    const settled = frames.find((f) => f.name === 'settled')?.data as
      | { cause?: string; error?: { code?: string; message?: string }; usage?: { inputTokens?: number; outputTokens?: number }; cost?: number }
      | undefined;
    const terminal = engine.find((e) => e.type === 'terminal') as
      | Extract<EngineEvent, { type: 'terminal' }>
      | undefined;
    result.settledCause = settled?.cause ?? terminal?.cause;
    result.inputTokens = settled?.usage?.inputTokens;
    result.outputTokens = settled?.usage?.outputTokens;
    result.cost = settled?.cost;

    const verdict = classifyTerminal(result.settledCause, settled?.error ?? terminal?.error);
    if (verdict === 'cred-skip') {
      result.status = 'SKIP';
      result.reason = `not exercised: ${settled?.error?.code ?? terminal?.error?.code ?? 'provision'} — ${(settled?.error?.message ?? terminal?.error?.message ?? '').slice(0, 140)}`;
      return result;
    }

    // Preview probe (best-effort; only hard-gated when expected).
    if (result.previewUrl) {
      let body = '';
      for (let i = 0; i < 12; i++) {
        try {
          const r = await httpText(result.previewUrl);
          result.previewStatus = r.status;
          body = r.body;
          if (r.status === 200) break;
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      result.previewLooksLikeApp = bodyLooksLikeApp(body, MARKER);
    }

    if (result.runId) {
      const h = await verifyHistory(BASE, result.runId, expectPreview(t), authHeader).catch(() => ({
        listed: false,
        detailOk: false,
      }));
      result.historyListed = h.listed;
      result.historyDetailOk = h.detailOk;
    }

    const previewPass =
      !expectPreview(t) || (!!result.previewUrl && result.previewStatus === 200 && result.previewLooksLikeApp === true);
    const pass = verdict === 'done' && previewPass && result.historyListed === true && result.historyDetailOk === true;
    result.status = pass ? 'PASS' : 'FAIL';
    if (!pass) {
      result.reason =
        `settled=${result.settledCause ?? 'none'} preview=${result.previewStatus ?? 'none'} ` +
        `looksLikeApp=${result.previewLooksLikeApp ?? false} historyListed=${result.historyListed ?? false} ` +
        `historyDetail=${result.historyDetailOk ?? false}`;
    }
    return result;
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
    result.status = 'FAIL';
    result.error = err instanceof Error ? err.message : String(err);
    result.reason = aborted ? `cell timed out after ${CELL_TIMEOUT_MS}ms` : result.error;
    return result;
  } finally {
    clearTimeout(timer);
    result.durationMs = Date.now() - started;
    if (frames.length) {
      fs.appendFileSync(
        EVENTS_PATH,
        JSON.stringify({ at: new Date().toISOString(), cell: label, loop, runId: result.runId, frames }) + '\n',
      );
    }
    console.log(
      `[matrix] ${result.status} ${label} runId=${result.runId ?? '?'} preview=${result.previewUrl ?? '-'} ${result.reason ? `(${result.reason})` : ''}`,
    );
  }
}

function writeReport(triples: Triple[], results: CellResult[], authMode: string): void {
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE,
        authMode,
        loops: LOOPS,
        compatibleTriples: triples.map(tripleKey),
        totals: { attempted: pass + fail, passed: pass, failed: fail, skipped: skip },
        results,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  console.log(`\n=== LIVE harness × env × topology matrix ===`);
  console.log(`target: ${BASE}`);
  const registry = await fetchRegistry(BASE);
  const allTriples = enumerateCompatibleTriples(registry.topologyMatrix);
  let triples = allTriples.filter(selected);
  if (MAX > 0) triples = triples.slice(0, MAX);

  console.log(
    `catalog: harnesses=[${registry.harnesses.join(', ')}]  environments=[${registry.environments.join(', ')}]`,
  );
  console.log(`compatible triples: ${allTriples.length}  ·  selected: ${triples.length}`);
  for (const t of triples) console.log(`  • ${tripleKey(t)}${expectPreview(t) ? '  (expects preview)' : ''}`);

  if (DRY_RUN) {
    console.log(`\n[dry-run] enumeration only — no runs. Report not written.\n`);
    return;
  }
  if (triples.length === 0) {
    console.log(`\nNo triples selected — adjust --harness/--env/--topology/--only.\n`);
    process.exit(2);
  }

  const authHeader = await resolveAuthHeader(BASE);
  const authMode = process.env.EVAL_BEARER
    ? 'bearer'
    : process.env.EVAL_EMAIL
      ? 'login'
      : 'none(dev-no-auth?)';
  console.log(`auth: ${authMode}\n`);
  if (fs.existsSync(EVENTS_PATH)) fs.unlinkSync(EVENTS_PATH);

  const results: CellResult[] = [];
  for (let loop = 0; loop < LOOPS; loop++) {
    for (const t of triples) {
      const r = await runCell(t, loop, authHeader);
      results.push(r);
      writeReport(triples, results, authMode);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log(`\n==================== live matrix summary ====================`);
  console.log(`target=${BASE}  attempted=${pass + fail} passed=${pass} failed=${fail} skipped=${skip}`);
  for (const r of results) {
    console.log(`${r.status.padEnd(4)} ${tripleKey(r).padEnd(40)} ${r.reason ?? r.previewUrl ?? '-'}`);
  }
  console.log(`report=${REPORT_PATH}`);
  console.log(`events=${EVENTS_PATH}`);
  console.log(`=============================================================`);

  if (fail > 0) process.exit(1);
  if (pass + fail === 0) process.exit(2); // everything skipped → nothing proven
  process.exit(0);
}

main().catch((err) => {
  console.error('[matrix] FATAL:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
