import fs from 'node:fs';
import path from 'node:path';

type CellStatus = 'PASS' | 'FAIL' | 'SKIP';

interface CellResult {
  harness: string;
  environment: string;
  status: CellStatus;
  reason?: string;
  runId?: string;
  sessionId?: string;
  previewUrl?: string;
  historyUrl?: string;
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
  durationMs?: number;
}

interface Report {
  generatedAt: string;
  serverUrl: string;
  totals: { attempted: number; passed: number; failed: number; skipped: number };
  results: CellResult[];
  excluded?: Array<{
    harness: string;
    environment: string;
    reason?: string;
  }>;
}

interface EventRow {
  cell: string;
  runId?: string;
  events: Array<{ name: string; data: unknown }>;
}

const ROOT = path.resolve(import.meta.dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-report.json');
const EVENTS_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-events.jsonl');
const PROOF_MD_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-proof.md');
const PROOF_JSON_PATH = path.join(ROOT, 'docs-evidence', 'manual-web-eval-proof.json');
const CURRENT_SERVER_URL = process.env.PROOF_SERVER_URL ?? 'http://localhost:3010';

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function readRows(file: string): EventRow[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRow);
}

function redactedUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/([?&]preview_token=)[^&]+/g, '$1[redacted]');
}

function eventType(e: { name: string; data: unknown }): string {
  if (e.data && typeof e.data === 'object' && 'type' in e.data) {
    return String((e.data as { type: unknown }).type);
  }
  return e.name;
}

function messageOf(e: { data: unknown }): string | null {
  if (!e.data || typeof e.data !== 'object' || !('message' in e.data)) return null;
  return String((e.data as { message: unknown }).message);
}

function logCategory(e: { data: unknown }): string | null {
  if (!e.data || typeof e.data !== 'object' || !('category' in e.data)) return null;
  return String((e.data as { category: unknown }).category);
}

function toolName(e: { data: unknown }): string | null {
  if (!e.data || typeof e.data !== 'object' || !('name' in e.data)) return null;
  return String((e.data as { name: unknown }).name);
}

function finalText(events: EventRow['events']): string | null {
  const ev = [...events].reverse().find((e) => eventType(e) === 'final_text');
  if (!ev?.data || typeof ev.data !== 'object' || !('text' in ev.data)) return null;
  return String((ev.data as { text: unknown }).text);
}

function terminalCause(events: EventRow['events']): string | null {
  const ev = [...events].reverse().find((e) => eventType(e) === 'terminal');
  if (!ev?.data || typeof ev.data !== 'object' || !('cause' in ev.data)) return null;
  return String((ev.data as { cause: unknown }).cause);
}

function selectedLogs(events: EventRow['events'], category: string): string[] {
  return events
    .filter((e) => eventType(e) === 'log' && logCategory(e) === category)
    .map(messageOf)
    .filter((m): m is string => !!m)
    .filter((m) =>
      /provision|created|started|workspace|port|exposed|reachable|session|prompting|settled|install|dev server|gateway|sandbox|container/i.test(
        m
      )
    )
    .slice(0, 8);
}

function toolSummary(events: EventRow['events']): string[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const type = eventType(ev);
    if (type !== 'tool_call') continue;
    const name = toolName(ev) ?? 'tool';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => `${name} x${count}`);
}

function truncate(s: string | null, max = 220): string | null {
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function main(): void {
  const report = readJson<Report>(REPORT_PATH);
  const rows = readRows(EVENTS_PATH);
  const rowsByRun = new Map(rows.map((row, idx) => [row.runId, { ...row, line: idx + 1 }]));

  const proof = {
    generatedAt: new Date().toISOString(),
    sourceReport: REPORT_PATH,
    sourceEvents: EVENTS_PATH,
    serverUrlForHistoryLinks: CURRENT_SERVER_URL,
    totals: report.totals,
    cells: report.results.map((result) => {
      const row = result.runId ? rowsByRun.get(result.runId) : undefined;
      const events = row?.events ?? [];
      return {
        pair: `${result.harness} x ${result.environment}`,
        status: result.status,
        runId: result.runId,
        sessionId: result.sessionId,
        terminalCause: result.settledCause ?? terminalCause(events),
        historyUrl: result.runId ? `${CURRENT_SERVER_URL}/history/${encodeURIComponent(result.runId)}` : undefined,
        historyListed: result.historyListed,
        historyDetailOk: result.historyDetailOk,
        previewExpected: result.previewExpected,
        previewUrl: redactedUrl(result.previewUrl),
        previewStatus: result.previewStatus,
        previewLooksLikeApp: result.previewLooksLikeApp,
        durationMs: result.durationMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost,
        eventRow: row?.line,
        eventCount: events.length,
        envEvidence: selectedLogs(events, 'env'),
        harnessEvidence: selectedLogs(events, 'harness'),
        kernelEvidence: selectedLogs(events, 'kernel'),
        toolCalls: toolSummary(events),
        finalText: truncate(finalText(events)),
        reason: result.reason,
      };
    }),
    excluded: report.excluded ?? [],
  };

  fs.writeFileSync(PROOF_JSON_PATH, `${JSON.stringify(proof, null, 2)}\n`);

  const lines: string[] = [];
  lines.push('# Manual Web Eval Proof');
  lines.push('');
  lines.push(`Generated: ${proof.generatedAt}`);
  lines.push(`Source report: \`${path.relative(ROOT, REPORT_PATH)}\``);
  lines.push(`Raw events: \`${path.relative(ROOT, EVENTS_PATH)}\``);
  lines.push(`Machine proof JSON: \`${path.relative(ROOT, PROOF_JSON_PATH)}\``);
  lines.push('');
  lines.push(
    `Totals: attempted=${report.totals.attempted}, passed=${report.totals.passed}, failed=${report.totals.failed}, skipped=${report.totals.skipped}`
  );
  lines.push('');

  for (const cell of proof.cells) {
    lines.push(`## ${cell.pair} — ${cell.status}`);
    lines.push('');
    lines.push(`- Run ID: \`${cell.runId ?? '-'}\``);
    lines.push(`- Session ID: \`${cell.sessionId ?? '-'}\``);
    lines.push(`- Terminal: \`${cell.terminalCause ?? '-'}\``);
    lines.push(`- History: ${cell.historyUrl ?? '-'} (listed=${cell.historyListed}, detail=${cell.historyDetailOk})`);
    if (cell.previewExpected) {
      lines.push(
        `- Preview: ${cell.previewUrl ?? '-'} (status=${cell.previewStatus ?? '-'}, looksLikeApp=${cell.previewLooksLikeApp ?? '-'})`
      );
    } else {
      lines.push('- Preview: not expected for this pair');
    }
    lines.push(`- Raw event row: ${cell.eventRow ?? '-'} (${cell.eventCount} events)`);
    if (cell.toolCalls.length) lines.push(`- Tool calls: ${cell.toolCalls.join(', ')}`);
    if (cell.envEvidence.length) lines.push(`- Env proof: ${cell.envEvidence.join(' | ')}`);
    if (cell.harnessEvidence.length) lines.push(`- Harness proof: ${cell.harnessEvidence.join(' | ')}`);
    if (cell.finalText) lines.push(`- Final text: ${cell.finalText}`);
    if (cell.reason) lines.push(`- Reason: ${cell.reason}`);
    lines.push('');
  }

  if (proof.excluded.length) {
    lines.push('## Excluded Not-Ready Pairs');
    lines.push('');
    for (const item of proof.excluded) {
      lines.push(`- \`${item.harness} x ${item.environment}\`: ${item.reason ?? '-'}`);
    }
    lines.push('');
  }

  fs.writeFileSync(PROOF_MD_PATH, `${lines.join('\n')}\n`);
  console.log(`proof=${PROOF_MD_PATH}`);
  console.log(`proofJson=${PROOF_JSON_PATH}`);
}

main();

