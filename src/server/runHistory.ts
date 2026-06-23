// src/server/runHistory.ts
// Additive run-history persistence. The server tees every EngineEvent of a run
// into a Recorder; on settlement it appends ONE JSONL line (full event stream +
// derived metadata) to `.history/runs.jsonl`. The kernel/orchestrator are
// untouched — this lives entirely in the transport layer.
//
// Format: append-only JSONL (one PersistedRun per line). Newest-last on disk;
// the read API returns newest-first. Reloadable on restart by re-reading the
// file. Simple, greppable, no DB.

import { appendFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineEvent } from '../types/index.js';
import type { RunResult } from '../kernel/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Build root is two levels up from src/server/. Keep the store at the build root
// so it survives across dev restarts and is easy to find.
const HISTORY_DIR = path.resolve(HERE, '..', '..', '.history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'runs.jsonl');

// Metadata captured per run — everything the Studio history panel header shows.
export interface RunMetadata {
  runId: string;
  sessionId: string;
  timestamp: number; // epoch ms, run start
  harnessRef: string;
  envRef: string;
  model: string | null;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  terminalCause: string | null;
  sandboxId: string | null;
  previewUrl: string | null;
}

export interface PersistedRun extends RunMetadata {
  events: EngineEvent[];
}

// A live per-run accumulator. The server creates one at the start of /message,
// teeing every EngineEvent into it, then calls finalize() once the run settles.
export class RunRecorder {
  private readonly events: EngineEvent[] = [];
  private previewUrl: string | null = null;
  private sandboxId: string | null = null;
  private readonly startedAt = Date.now();

  constructor(
    private readonly runId: string,
    private readonly sessionId: string,
    private readonly harnessRef: string,
    private readonly envRef: string,
    private readonly model: string | null,
    private readonly prompt: string
  ) {}

  // Tee one event. Pulls out preview/sandbox hints opportunistically so the
  // metadata header is populated even if the caller never tells us directly.
  observe(ev: EngineEvent): void {
    this.events.push(ev);
    if (ev.type === 'preview_ready') this.previewUrl = ev.url;
  }

  // Optional: the transport may know a sandbox id from the env handle.
  setSandboxId(id: string | null): void {
    if (id) this.sandboxId = id;
  }

  // Append the finalized run to the JSONL store. Called once, on settlement.
  async finalize(result: RunResult): Promise<PersistedRun> {
    const run: PersistedRun = {
      runId: this.runId,
      sessionId: this.sessionId,
      timestamp: this.startedAt,
      harnessRef: this.harnessRef,
      envRef: this.envRef,
      model: this.model,
      prompt: this.prompt,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost: result.cost,
      durationMs: Date.now() - this.startedAt,
      terminalCause: result.cause ?? null,
      sandboxId: this.sandboxId,
      previewUrl: this.previewUrl,
      events: this.events,
    };
    await appendRun(run);
    return run;
  }
}

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await mkdir(HISTORY_DIR, { recursive: true });
  dirReady = true;
}

// Append one run as a single JSONL line. Best-effort: persistence must never
// break a live run, so failures are swallowed (logged) here.
async function appendRun(run: PersistedRun): Promise<void> {
  try {
    await ensureDir();
    await appendFile(HISTORY_FILE, JSON.stringify(run) + '\n', 'utf8');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[runHistory] failed to persist run:', err instanceof Error ? err.message : err);
  }
}

// Read all persisted runs (newest-first). Tolerant of a missing file (returns
// []) and of a partially-written trailing line (skips unparseable lines).
async function readAllRuns(): Promise<PersistedRun[]> {
  let raw: string;
  try {
    raw = await readFile(HISTORY_FILE, 'utf8');
  } catch {
    return [];
  }
  const runs: PersistedRun[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      runs.push(JSON.parse(trimmed) as PersistedRun);
    } catch {
      // Skip a partial/corrupt line rather than failing the whole listing.
    }
  }
  // Newest-first for the history panel.
  return runs.sort((a, b) => b.timestamp - a.timestamp);
}

// GET /history → metadata only (no event arrays — keep the list payload small).
export async function listRunMetadata(): Promise<RunMetadata[]> {
  const runs = await readAllRuns();
  return runs.map(({ events: _events, ...meta }) => meta);
}

// GET /history/:runId → the full persisted run (events + metadata), or null.
export async function getRun(runId: string): Promise<PersistedRun | null> {
  const runs = await readAllRuns();
  return runs.find((r) => r.runId === runId) ?? null;
}
