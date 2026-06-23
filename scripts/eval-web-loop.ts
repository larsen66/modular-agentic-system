// scripts/eval-web-loop.ts
// Evaluation loop for the ready-to-use harness x environment matrix.
//
// It drives the same HTTP/SSE surface the Studio uses, persists a JSON report,
// and prints preview/history URLs so David can manually inspect each run in a
// browser between or after loops.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { Kernel } from '../src/kernel/index.js';
import { buildServer } from '../src/server/http.js';
import { loadOptionalAdapters } from '../src/server/bootstrap.js';
import type { EngineEvent } from '../src/types/index.js';

type CellStatus = 'PASS' | 'FAIL' | 'SKIP';

interface MatrixCell {
  harness: string;
  environment: string;
  placement: 'control-plane-tools' | 'agent-inside-sandbox' | 'hybrid';
  ready: boolean;
  reason?: string;
  prereqs: string[];
  expectPreview: boolean;
  model?: string;
  runtimeProfile?: string;
}

interface CellResult {
  harness: string;
  environment: string;
  placement: MatrixCell['placement'];
  status: CellStatus;
  reason?: string;
  runId?: string;
  sessionId?: string;
  previewUrl?: string;
  historyUrl?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  settledCause?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  previewStatus?: number;
  previewLooksLikeApp?: boolean;
  previewExpected?: boolean;
  historyListed?: boolean;
  historyDetailOk?: boolean;
  eventCounts?: Record<string, number>;
  error?: string;
}

interface Report {
  generatedAt: string;
  serverUrl: string;
  manualMode: boolean;
  matrix: MatrixCell[];
  excluded: MatrixCell[];
  totals: {
    attempted: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  results: CellResult[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..', '..', '..');
const HARNESS_ENV = path.join(REPO_ROOT, '.harness.env');
const REPORT_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-report.json');
const EVENTS_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-events.jsonl');

const PROMPT =
  'Build a tiny Vite React app named Matrix Cell Proof. Include the exact text "matrix-cell-proof" visibly in the page, then start the dev server and expose it.';
const DEFAULT_CELL_TIMEOUT_MS = 8 * 60 * 1000;

const READY_MATRIX: MatrixCell[] = [
  { harness: 'sdk', environment: 'docker', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY'], expectPreview: true },
  { harness: 'sdk', environment: 'e2b', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'E2B_API_KEY'], expectPreview: true },
  { harness: 'sdk', environment: 'daytona', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'DAYTONA_API_KEY'], expectPreview: true },
  { harness: 'sdk', environment: 'codesandbox', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'CSB_API_KEY'], expectPreview: true },
  { harness: 'openai-agents', environment: 'docker', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY'], expectPreview: true },
  { harness: 'openai-agents', environment: 'e2b', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'E2B_API_KEY'], expectPreview: true },
  { harness: 'openai-agents', environment: 'daytona', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'DAYTONA_API_KEY'], expectPreview: true },
  { harness: 'openai-agents', environment: 'codesandbox', placement: 'control-plane-tools', ready: true, prereqs: ['OPENROUTER_API_KEY', 'CSB_API_KEY'], expectPreview: true },
  { harness: 'claude-cli', environment: 'local', placement: 'agent-inside-sandbox', ready: true, prereqs: ['bin:claude'], expectPreview: true },
  { harness: 'opencode', environment: 'local', placement: 'agent-inside-sandbox', ready: true, prereqs: ['bin:opencode', 'OPENROUTER_API_KEY'], expectPreview: false, model: 'openrouter/openai/gpt-4o-mini' },
  { harness: 'codex-cli', environment: 'local', placement: 'agent-inside-sandbox', ready: true, prereqs: ['bin:codex', 'file:~/.codex/auth.json'], expectPreview: true },
];

const EXCLUDED_MATRIX: MatrixCell[] = [
  {
    harness: 'opencode',
    environment: 'non-local',
    placement: 'agent-inside-sandbox',
    ready: false,
    prereqs: [],
    expectPreview: false,
    reason: 'mode-2 live-agent-in-sandbox path is verified only for local; remote sandbox packaging is not ready out of the box.',
  },
  {
    harness: 'claude-agent-sdk',
    environment: '*',
    placement: 'control-plane-tools',
    ready: false,
    prereqs: ['ANTHROPIC_API_KEY'],
    expectPreview: true,
    reason: 'not part of the current OpenRouter-ready set; requires Anthropic credential path.',
  },
  {
    harness: 'pi',
    environment: '*',
    placement: 'hybrid',
    ready: false,
    prereqs: ['OPENROUTER_API_KEY'],
    expectPreview: false,
    // VERIFIED REAL: pi/verify.ts passes live against OpenRouter (real generation,
    // EngineEvents, settles once with cause=done). Excluded from THIS preview eval
    // only: pi runs its own bash loop in a control-plane tmpdir and itself invokes
    // the blocking `npm run dev`, never calling env.exposePort — so the
    // "start the dev server and expose it" prompt hangs until the cell is killed.
    // pi fits a non-server generation eval, not the preview matrix.
    reason: 'control-plane agent: blocks on its own `npm run dev` and never calls env.exposePort, so the preview prompt cannot settle. Real generation is proven by src/harnesses/pi/verify.ts (live PASS).',
  },
];

function loadHarnessEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(HARNESS_ENV)) return out;
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

function applyKeys(): void {
  const env = loadHarnessEnv();
  const map: Record<string, string> = {
    E2B: 'E2B_API_KEY',
    Daytona: 'DAYTONA_API_KEY',
  };
  for (const [source, target] of Object.entries(map)) {
    if (env[source] && !process.env[target]) process.env[target] = env[source];
  }
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }
  const openRouter = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || env.OPENROUTER;
  if (openRouter) {
    process.env.OPENROUTER_API_KEY = openRouter;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || openRouter;
    process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    process.env.SDK_MODEL = process.env.SDK_MODEL || 'openai/gpt-4o-mini';
    process.env.OPENAI_AGENTS_MODEL = process.env.OPENAI_AGENTS_MODEL || 'openai/gpt-4o-mini';
  }
}

function missingPrereqs(cell: MatrixCell): string[] {
  return cell.prereqs.filter((name) => {
    if (name.startsWith('bin:')) {
      const bin = name.slice('bin:'.length);
      return spawnSync(bin, ['--version'], { stdio: 'ignore' }).status !== 0;
    }
    if (name.startsWith('file:')) {
      const p = name.slice('file:'.length).replace(/^~(?=\/|$)/, homedir());
      return !fs.existsSync(p);
    }
    return !process.env[name];
  });
}

async function startServer(port: number): Promise<{ app: FastifyInstance; url: string }> {
  await loadOptionalAdapters();
  const app = buildServer(new Kernel());
  await app.listen({ host: '127.0.0.1', port });
  const address = app.server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return { app, url: `http://127.0.0.1:${actualPort}` };
}

function parseSseChunk(
  text: string,
  state: { eventName: string | null; dataLines: string[] },
  onEvent: (name: string, data: unknown) => void
): void {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line === '') {
      if (state.dataLines.length) {
        const name = state.eventName || 'message';
        const raw = state.dataLines.join('\n');
        try {
          onEvent(name, JSON.parse(raw));
        } catch {
          onEvent(name, raw);
        }
      }
      state.eventName = null;
      state.dataLines = [];
      continue;
    }
    if (line.startsWith('event:')) state.eventName = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) state.dataLines.push(line.slice('data:'.length).trimStart());
  }
}

async function readSse(
  res: Response,
  events: { name: string; data: unknown }[] = []
): Promise<{ events: { name: string; data: unknown }[] }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('SSE response body is empty');
  const decoder = new TextDecoder();
  const state = { eventName: null as string | null, dataLines: [] as string[] };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parseSseChunk(decoder.decode(value, { stream: true }), state, (name, data) => events.push({ name, data }));
  }
  parseSseChunk('\n', state, (name, data) => events.push({ name, data }));
  return { events };
}

async function httpText(url: string, timeoutMs = 12_000): Promise<{ status: number; body: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

function eventCounts(events: { name: string; data: unknown }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const key = e.name === 'message' && isEngineEvent(e.data) ? e.data.type : e.name;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function isEngineEvent(v: unknown): v is EngineEvent {
  return !!v && typeof v === 'object' && 'type' in v;
}

function bodyLooksLikeApp(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes('matrix-cell-proof') ||
    lower.includes('id="root"') ||
    lower.includes('/@vite/') ||
    lower.includes('vite') ||
    lower.includes('type="module"')
  );
}

async function verifyHistory(
  serverUrl: string,
  runId: string,
  expectPreview: boolean
): Promise<{ listed: boolean; detailOk: boolean }> {
  const listRes = await fetch(`${serverUrl}/history`);
  const listJson = (await listRes.json().catch(() => ({}))) as { runs?: { runId?: string }[] };
  const listed = Array.isArray(listJson.runs) && listJson.runs.some((r) => r.runId === runId);

  const detailRes = await fetch(`${serverUrl}/history/${encodeURIComponent(runId)}`);
  if (!detailRes.ok) return { listed, detailOk: false };
  const detail = (await detailRes.json().catch(() => ({}))) as { events?: EngineEvent[]; result?: { cause?: string } };
  const events = detail.events ?? [];
  const hasPreview = events.some((e) => e.type === 'preview_ready');
  const hasTerminal = events.some((e) => e.type === 'terminal') || !!detail.result?.cause;
  return { listed, detailOk: (!expectPreview || hasPreview) && hasTerminal };
}

async function maybePause(manualMode: boolean, label: string): Promise<void> {
  if (!manualMode) return;
  process.stdout.write(`\n[eval:web] Manual check point for ${label}. Press Enter to continue...`);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

async function runCell(
  serverUrl: string,
  cell: MatrixCell,
  manualMode: boolean,
  cellTimeoutMs: number
): Promise<CellResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const missing = missingPrereqs(cell);
  if (missing.length) {
    return {
      harness: cell.harness,
      environment: cell.environment,
      placement: cell.placement,
      status: 'SKIP',
      reason: `missing prereqs: ${missing.join(', ')}`,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }

  const sessionId = `eval-${cell.harness}-${cell.environment}-${Date.now()}`;
  const label = `${cell.harness} x ${cell.environment}`;
  const result: CellResult = {
    harness: cell.harness,
    environment: cell.environment,
    placement: cell.placement,
    status: 'FAIL',
    sessionId,
    previewExpected: cell.expectPreview,
    startedAt,
  };
  let events: { name: string; data: unknown }[] = [];

  try {
    console.log(`\n[eval:web] RUN ${label}`);
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), cellTimeoutMs);
    const response = await fetch(`${serverUrl}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        harness: cell.harness,
        environment: cell.environment,
        sessionId,
        prompt: PROMPT,
        model: cell.model,
        runtimeProfile: cell.runtimeProfile,
        ports: [5173],
        source: { kind: 'files', files: [] },
      }),
    }).finally(() => clearTimeout(timeout));
    if (!response.ok || !response.body) throw new Error(`POST /message returned ${response.status}`);

    const readTimeout = setTimeout(() => ac.abort(), cellTimeoutMs);
    ({ events } = await readSse(response, events).finally(() => clearTimeout(readTimeout)));
    result.eventCounts = eventCounts(events);

    const runStarted = events.find((e) => e.name === 'run_started')?.data as { runId?: string } | undefined;
    result.runId = runStarted?.runId;

    const engineEvents = events
      .filter((e) => isEngineEvent(e.data))
      .map((e) => e.data as EngineEvent);
    const preview = engineEvents.find((e) => e.type === 'preview_ready') as Extract<EngineEvent, { type: 'preview_ready' }> | undefined;
    result.previewUrl = preview?.url;
    if (result.runId) result.historyUrl = `${serverUrl}/history/${encodeURIComponent(result.runId)}`;

    const settled = events.find((e) => e.name === 'settled')?.data as
      | { cause?: string; usage?: { inputTokens?: number; outputTokens?: number }; cost?: number }
      | undefined;
    result.settledCause = settled?.cause;
    result.inputTokens = settled?.usage?.inputTokens;
    result.outputTokens = settled?.usage?.outputTokens;
    result.cost = settled?.cost;

    if (result.previewUrl) {
      let previewBody = '';
      for (let i = 0; i < 12; i++) {
        try {
          const res = await httpText(result.previewUrl);
          result.previewStatus = res.status;
          previewBody = res.body;
          if (res.status === 200) break;
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      result.previewLooksLikeApp = bodyLooksLikeApp(previewBody);
    }

    if (result.runId) {
      const history = await verifyHistory(serverUrl, result.runId, cell.expectPreview);
      result.historyListed = history.listed;
      result.historyDetailOk = history.detailOk;
    }

    const previewPass = !cell.expectPreview || (
      !!result.previewUrl &&
      result.previewStatus === 200 &&
      result.previewLooksLikeApp === true
    );
    const pass =
      result.settledCause === 'done' &&
      previewPass &&
      result.historyListed === true &&
      result.historyDetailOk === true;
    result.status = pass ? 'PASS' : 'FAIL';
    if (!pass) {
      result.reason =
        `settled=${result.settledCause ?? 'none'} preview=${result.previewStatus ?? 'none'} ` +
        `looksLikeApp=${result.previewLooksLikeApp ?? false} historyListed=${result.historyListed ?? false} ` +
        `historyDetail=${result.historyDetailOk ?? false}`;
    }

    fs.appendFileSync(
      EVENTS_PATH,
      JSON.stringify({ at: new Date().toISOString(), cell: label, runId: result.runId, events }) + '\n'
    );

    console.log(
      `[eval:web] ${result.status} ${label} runId=${result.runId ?? '?'} preview=${result.previewUrl ?? 'none'}`
    );
    if (result.previewUrl) console.log(`[eval:web] Manual preview URL: ${result.previewUrl}`);
    if (result.historyUrl) console.log(`[eval:web] Run history URL: ${result.historyUrl}`);
    await maybePause(manualMode, label);
  } catch (err) {
    if (events.length) {
      result.eventCounts = eventCounts(events);
      const runStarted = events.find((e) => e.name === 'run_started')?.data as { runId?: string } | undefined;
      result.runId = result.runId ?? runStarted?.runId;
      if (result.runId) result.historyUrl = `${serverUrl}/history/${encodeURIComponent(result.runId)}`;
      const engineEvents = events
        .filter((e) => isEngineEvent(e.data))
        .map((e) => e.data as EngineEvent);
      const preview = engineEvents.find((e) => e.type === 'preview_ready') as Extract<EngineEvent, { type: 'preview_ready' }> | undefined;
      result.previewUrl = result.previewUrl ?? preview?.url;
      fs.appendFileSync(
        EVENTS_PATH,
        JSON.stringify({ at: new Date().toISOString(), cell: label, runId: result.runId, partial: true, events }) + '\n'
      );
    }
    result.status = 'FAIL';
    const aborted =
      err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
    result.error = err instanceof Error ? err.stack ?? err.message : String(err);
    result.reason = aborted ? `cell timed out after ${cellTimeoutMs}ms` : err instanceof Error ? err.message : String(err);
  } finally {
    result.endedAt = new Date().toISOString();
    result.durationMs = Date.now() - started;
  }

  return result;
}

async function writeReport(report: Report): Promise<void> {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  applyKeys();
  const manualMode = process.argv.includes('--manual');
  const portArg = process.argv.find((arg) => arg.startsWith('--port='));
  const timeoutArg = process.argv.find((arg) => arg.startsWith('--cell-timeout-ms='));
  const cellsArg = process.argv.find((arg) => arg.startsWith('--cells='));
  const port = portArg ? Number(portArg.split('=')[1]) : Number(process.env.EVAL_KERNEL_PORT ?? 0);
  const cellTimeoutMs = timeoutArg
    ? Number(timeoutArg.split('=')[1])
    : Number(process.env.EVAL_CELL_TIMEOUT_MS ?? DEFAULT_CELL_TIMEOUT_MS);
  const selectedCells = cellsArg
    ? new Set(cellsArg.split('=')[1]!.split(',').map((s) => s.trim()).filter(Boolean))
    : null;
  const activeMatrix = selectedCells
    ? READY_MATRIX.filter((cell) => selectedCells.has(`${cell.harness}:${cell.environment}`))
    : READY_MATRIX;

  if (fs.existsSync(EVENTS_PATH)) fs.unlinkSync(EVENTS_PATH);

  const { app, url } = await startServer(port);
  console.log(`[eval:web] Kernel server: ${url}`);
  console.log(`[eval:web] Report: ${REPORT_PATH}`);
  console.log(`[eval:web] Events: ${EVENTS_PATH}`);
  console.log(`[eval:web] Manual mode: ${manualMode ? 'on' : 'off'}\n`);

  const results: CellResult[] = [];
  try {
    for (const cell of activeMatrix) {
      const result = await runCell(url, cell, manualMode, cellTimeoutMs);
      results.push(result);
      await writeReport(makeReport(url, manualMode, results, activeMatrix));
    }
  } finally {
    await writeReport(makeReport(url, manualMode, results, activeMatrix));
    if (!manualMode) await app.close();
  }

  const report = makeReport(url, manualMode, results, activeMatrix);
  printSummary(report);

  if (manualMode) {
    console.log('\n[eval:web] Manual mode keeps the kernel server alive. Stop with Ctrl-C when done.');
    await new Promise(() => undefined);
  }

  if (report.totals.failed > 0) process.exit(1);
  if (report.totals.attempted === 0) process.exit(2);
}

function makeReport(
  serverUrl: string,
  manualMode: boolean,
  results: CellResult[],
  matrix = READY_MATRIX
): Report {
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  return {
    generatedAt: new Date().toISOString(),
    serverUrl,
    manualMode,
    matrix,
    excluded: EXCLUDED_MATRIX,
    totals: {
      attempted: results.length - skipped,
      passed,
      failed,
      skipped,
    },
    results,
  };
}

function printSummary(report: Report): void {
  console.log('\n==================== eval:web summary ====================');
  console.log(`attempted=${report.totals.attempted} passed=${report.totals.passed} failed=${report.totals.failed} skipped=${report.totals.skipped}`);
  for (const r of report.results) {
    console.log(
      `${r.status.padEnd(4)} ${r.harness.padEnd(14)} x ${r.environment.padEnd(11)} ` +
        `preview=${r.previewUrl ?? '-'} reason=${r.reason ?? '-'}`
    );
  }
  console.log(`report=${REPORT_PATH}`);
  console.log('==========================================================');
}

main().catch((err) => {
  console.error('[eval:web] FATAL:', err);
  process.exit(1);
});
