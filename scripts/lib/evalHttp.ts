// scripts/lib/evalHttp.ts
// Shared HTTP/SSE plumbing for evals that drive the kernel's /message surface —
// whether in-process or against the LIVE deployment (https://dav-version.vercel.app).
// Pure transport: SSE parsing, the live registry shape, compatible-triple
// enumeration (mirrors src/kernel/capabilities.ts::resolveTopology), auth, and
// preview/history verification. No kernel imports → safe to point at a remote URL.

import type { EngineEvent, ExecutionTopology } from '../../src/types/index.js';

// ─── Live registry shape (subset of GET /registry we rely on) ────────────────
export interface TopologyMatrix {
  harnesses: { ref: string; topologies: ExecutionTopology[]; defaultTopology: ExecutionTopology }[];
  environments: { ref: string; hostsAgentRuntime: boolean }[];
}
export interface RegistrySnapshot {
  harnesses: string[];
  environments: string[];
  readyPairs?: string[];
  topologyMatrix: TopologyMatrix;
  profile?: { harness: string; environment: string; model?: string };
}

export async function fetchRegistry(baseUrl: string, timeoutMs = 20_000): Promise<RegistrySnapshot> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/registry`, { signal: ac.signal });
    if (!res.ok) throw new Error(`GET /registry → ${res.status}`);
    return (await res.json()) as RegistrySnapshot;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Compatible-triple enumeration ───────────────────────────────────────────
// A (harness, env, topology) is COMPATIBLE when the harness declares the topology
// AND the env can host it. This is the client-side mirror of
// capabilities.ts::hostableTopology: 'agent-as-tool' needs only exec() (any env);
// 'agent-in-sandbox' additionally needs env.hostsAgentRuntime. Derived from the
// LIVE catalog, so the matrix can never drift from what the kernel would run.
export interface Triple {
  harness: string;
  environment: string;
  topology: ExecutionTopology;
}

function hostable(
  topology: ExecutionTopology,
  harness: TopologyMatrix['harnesses'][number],
  env: TopologyMatrix['environments'][number],
): boolean {
  if (!harness.topologies.includes(topology)) return false;
  if (topology === 'agent-in-sandbox') return env.hostsAgentRuntime;
  return true;
}

export function enumerateCompatibleTriples(matrix: TopologyMatrix): Triple[] {
  const out: Triple[] = [];
  for (const h of matrix.harnesses) {
    for (const t of h.topologies) {
      for (const e of matrix.environments) {
        if (hostable(t, h, e)) out.push({ harness: h.ref, environment: e.ref, topology: t });
      }
    }
  }
  return out;
}

export const tripleKey = (t: Triple): string => `${t.harness}:${t.environment}:${t.topology}`;

// ─── Auth ────────────────────────────────────────────────────────────────────
// Order: explicit Bearer (EVAL_BEARER) → email/password login (EVAL_EMAIL +
// EVAL_PASSWORD via POST /auth/login) → none (works only when the target has
// DEV_NO_AUTH). Returns the Authorization header value, or null for no-auth.
export async function resolveAuthHeader(
  baseUrl: string,
  opts?: { bearer?: string; email?: string; password?: string },
): Promise<string | null> {
  const bearer = opts?.bearer ?? process.env.EVAL_BEARER;
  if (bearer) return `Bearer ${bearer.replace(/^Bearer\s+/i, '')}`;
  const email = opts?.email ?? process.env.EVAL_EMAIL;
  const password = opts?.password ?? process.env.EVAL_PASSWORD;
  if (email && password) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`POST /auth/login → ${res.status} (check EVAL_EMAIL/EVAL_PASSWORD)`);
    const json = (await res.json()) as { accessToken?: string };
    if (!json.accessToken) throw new Error('login succeeded but returned no accessToken');
    return `Bearer ${json.accessToken}`;
  }
  return null;
}

// ─── SSE parsing ─────────────────────────────────────────────────────────────
export interface SseFrame {
  name: string;
  data: unknown;
}

function parseSseChunk(
  text: string,
  state: { eventName: string | null; dataLines: string[] },
  onEvent: (name: string, data: unknown) => void,
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

export async function readSse(res: Response): Promise<SseFrame[]> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('SSE response body is empty');
  const decoder = new TextDecoder();
  const events: SseFrame[] = [];
  const state = { eventName: null as string | null, dataLines: [] as string[] };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parseSseChunk(decoder.decode(value, { stream: true }), state, (name, data) => events.push({ name, data }));
  }
  parseSseChunk('\n', state, (name, data) => events.push({ name, data }));
  return events;
}

export function isEngineEvent(v: unknown): v is EngineEvent {
  return !!v && typeof v === 'object' && 'type' in v;
}

export function engineEventsOf(frames: SseFrame[]): EngineEvent[] {
  return frames.filter((f) => isEngineEvent(f.data)).map((f) => f.data as EngineEvent);
}

export function eventCounts(frames: SseFrame[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of frames) {
    const key = f.name === 'message' && isEngineEvent(f.data) ? f.data.type : f.name;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ─── Terminal-cause classification ───────────────────────────────────────────
// A failed run is only a real FAIL if the harness/env was actually exercised. A
// provisioning/credential/auth failure is a SKIP for that cell (the matrix didn't
// get to test the combo) — distinguished by the terminal error code.
const PROVISION_ERROR_CODES = new Set([
  'provision_failed',
  'persist_failed',
  'unknown_capability_ref',
  'unsupported_topology',
  // The combo was not exercisable here, not a wrong result: the CLI binary is
  // absent from the chosen sandbox image (hermes path), or the CLI declares it
  // cannot run outside `local` at all (claude/codex local-login path). Both are
  // clean terminals — bucket them as SKIP, deterministically by code rather than
  // by fragile message-substring matching.
  'cli_missing_in_env',
  'env_unsupported',
  'pi_sdk_missing',
  'unauthorized',
]);
const CRED_ERROR_HINTS = [
  'api key',
  'api_key',
  'apikey',
  'unauthorized',
  '401',
  '403',
  'missing',
  'not configured',
  'credential',
  'login',
  'token',
  'not installed',
  'enoent',
  'e2b',
  'daytona',
  'codesandbox',
  'docker',
];

export function classifyTerminal(
  cause: string | undefined,
  error?: { code?: string; message?: string },
): 'done' | 'cred-skip' | 'fail' {
  if (cause === 'done') return 'done';
  const code = (error?.code ?? '').toLowerCase();
  const msg = (error?.message ?? '').toLowerCase();
  if (code && PROVISION_ERROR_CODES.has(code)) return 'cred-skip';
  if (CRED_ERROR_HINTS.some((h) => msg.includes(h))) return 'cred-skip';
  return 'fail';
}

// ─── Preview / history verification ──────────────────────────────────────────
export async function httpText(url: string, timeoutMs = 12_000): Promise<{ status: number; body: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export function bodyLooksLikeApp(body: string, marker?: string): boolean {
  const lower = body.toLowerCase();
  return (
    (marker ? lower.includes(marker.toLowerCase()) : false) ||
    lower.includes('id="root"') ||
    lower.includes('/@vite/') ||
    lower.includes('vite') ||
    lower.includes('type="module"')
  );
}

export async function verifyHistory(
  baseUrl: string,
  runId: string,
  expectPreview: boolean,
  authHeader: string | null,
): Promise<{ listed: boolean; detailOk: boolean }> {
  const headers: Record<string, string> = authHeader ? { authorization: authHeader } : {};
  const listRes = await fetch(`${baseUrl}/history`, { headers });
  // /history returns two shapes: the JSONL fallback uses `runId`; the Supabase
  // RLS path (listRunsForUser → runs_user_visible) uses `id`. Match either.
  const listJson = (await listRes.json().catch(() => ({}))) as { runs?: { runId?: string; id?: string }[] };
  const listed = Array.isArray(listJson.runs) && listJson.runs.some((r) => r.runId === runId || r.id === runId);

  const detailRes = await fetch(`${baseUrl}/history/${encodeURIComponent(runId)}`, { headers });
  if (!detailRes.ok) return { listed, detailOk: false };
  const detail = (await detailRes.json().catch(() => ({}))) as {
    events?: Array<Record<string, unknown>>;
    result?: { cause?: string };
    run?: { summary?: { cause?: string } };
  };
  // Event rows also differ: JSONL stores the raw EngineEvent (`e.type`); the
  // Supabase run_events rows wrap it as `{ event, data, ... }`. Read both.
  const events = detail.events ?? [];
  const evType = (e: Record<string, unknown>): unknown =>
    e.type ?? e.event ?? (e.data as { type?: unknown } | undefined)?.type;
  const hasPreview = events.some((e) => evType(e) === 'preview_ready');
  const hasTerminal =
    events.some((e) => evType(e) === 'terminal') || !!detail.result?.cause || !!detail.run?.summary?.cause;
  return { listed, detailOk: (!expectPreview || hasPreview) && hasTerminal };
}
