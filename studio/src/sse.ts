// studio/src/sse.ts
// A minimal SSE client over fetch + ReadableStream. EventSource can't POST a
// body, and our run endpoint is POST /message, so we parse the text/event-stream
// manually. Mirrors the server's EngineEvent shape (kept in sync by hand — the
// contract is small and frozen).

export type TerminalCause = 'done' | 'error' | 'cancelled';

// The execution-topology toggle (mirrors src/types/harness.ts::ExecutionTopology).
//   'agent-as-tool'    — agent loop on the control plane, sandbox driven as a tool.
//   'agent-in-sandbox' — agent process runs INSIDE the sandbox.
export type ExecutionTopology = 'agent-as-tool' | 'agent-in-sandbox';

// The /registry topology matrix: per-harness supported topologies + per-env
// whether it can host an agent runtime (the gate for agent-in-sandbox). The UI
// composes valid (harness, env, topology) triples from this.
export interface TopologyMatrix {
  harnesses: { ref: string; topologies: ExecutionTopology[]; defaultTopology: ExecutionTopology }[];
  environments: { ref: string; hostsAgentRuntime: boolean }[];
}

export type EngineEvent =
  | { type: 'stream_chunk'; text: string }
  | { type: 'tool_call'; name: string; args?: unknown; callId?: string }
  | { type: 'tool_result'; ok: boolean; output?: string; callId?: string }
  | { type: 'usage_delta'; inputTokens: number; outputTokens: number }
  | { type: 'preview_ready'; url: string; port: number }
  | { type: 'final_text'; text: string }
  | {
      type: 'log';
      category: 'kernel' | 'env' | 'harness';
      level: 'info' | 'warn' | 'error';
      message: string;
      at: number;
    }
  | { type: 'terminal'; cause: TerminalCause; error?: { code: string; message: string } };

export interface RegistryDefaults {
  harness: string;
  environment: string;
  reason: string;
  hasApiKey: boolean;
  hermes: { installed: boolean; loggedIn: boolean };
  claude: { installed: boolean; loggedIn: boolean };
  codex: { installed: boolean; loggedIn: boolean };
}

export interface RunRequest {
  harness: string;
  environment: string;
  prompt: string;
  sessionId: string;
  // Attribute the run to a project so it persists into Supabase under the
  // caller's identity (admission.principal). Omitted → JSONL fallback.
  projectId?: string;
  // Execution-topology toggle. Omitted → the kernel picks the harness default
  // for the chosen env.
  topology?: ExecutionTopology;
}

export interface RunCallbacks {
  onEvent: (eventName: string, data: unknown) => void;
  signal?: AbortSignal;
}

// ── auth: a JWT obtained via the runner's /auth/login proxy ────────────────
let authToken: string | null = null;
export function setAuthToken(t: string | null): void {
  authToken = t;
}
export function getAuthToken(): string | null {
  return authToken;
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return authToken ? { ...extra, Authorization: `Bearer ${authToken}` } : extra;
}

export interface AuthUser {
  id: string;
  email: string;
}

// Log in through the runner (which proxies GoTrue). Stores the token for all
// subsequent calls and returns the user identity.
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('login failed');
  const json = (await res.json()) as { accessToken: string; user: AuthUser };
  authToken = json.accessToken;
  return json.user;
}

export interface ProjectItem {
  id: string;
  name: string;
  workspace_id: string;
}

// Projects the logged-in user may access (RLS-scoped on the server).
export async function fetchProjects(): Promise<ProjectItem[]> {
  const res = await fetch('/projects', { headers: authHeaders() });
  if (!res.ok) return [];
  const json = (await res.json()) as { projects?: ProjectItem[] };
  return json.projects ?? [];
}

export async function streamRun(req: RunRequest, cb: RunCallbacks): Promise<void> {
  const res = await fetch('/message', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(req),
    signal: cb.signal,
  });
  if (!res.body) throw new Error('no response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = 'message';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine += line.slice(6);
      }
      if (dataLine) {
        try {
          cb.onEvent(eventName, JSON.parse(dataLine));
        } catch {
          cb.onEvent(eventName, dataLine);
        }
      }
    }
  }
}

export async function fetchRegistry(): Promise<{
  harnesses: string[];
  environments: string[];
  // Verified-ready (harness × environment) pairs, format 'harnessRef x envRef'.
  // Drives the dropdown compatibility highlighting.
  readyPairs?: string[];
  // Per-harness topologies + per-env hostsAgentRuntime — drives the topology toggle.
  topologyMatrix?: TopologyMatrix;
  defaults?: RegistryDefaults;
}> {
  const res = await fetch('/registry');
  return res.json();
}

// Run-history shape — mirrors the server's RLS view `runs_user_visible`
// (src/server/db/historyRead.ts::RunListItem). Returned ALREADY RLS-filtered:
// the list only ever contains runs the logged-in user may see.
export interface RunListItem {
  id: string;
  project_id: string;
  workspace_id: string;
  session_id: string | null;
  chat_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  provider: string | null;
  model: string | null;
  // Settlement summary (usage/cost/cause/finalText) — present on /history/:id.
  summary?: {
    usage?: { inputTokens?: number; outputTokens?: number };
    cost?: number;
    cause?: string;
    finalText?: string;
  } | null;
  // null when the caller is the actor; otherwise the other actor's UUID.
  owned_by_other_user_id: string | null;
  collaborator_display_name: string | null;
}

// /history/:runId → the run + its ordered event stream. The server stored each
// EngineEvent as run_events.data; we surface the raw rows so the replay view can
// read `.data` (the EngineEvent) plus `.seq`/`.ts`.
export interface PersistedRunEvent {
  event: string;
  source: string;
  level: string;
  data: EngineEvent;
  seq: number;
  ts: string;
}
export interface PersistedRun {
  run: RunListItem;
  events: PersistedRunEvent[];
}

export async function fetchHistory(): Promise<RunListItem[]> {
  const res = await fetch('/history', { headers: authHeaders() });
  if (!res.ok) return [];
  const json = (await res.json()) as { runs?: RunListItem[] };
  return json.runs ?? [];
}

export async function fetchRun(runId: string): Promise<PersistedRun | null> {
  const res = await fetch(`/history/${runId}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as PersistedRun;
}

export interface ArchitectureContext {
  generatedAt: string;
  runtime: {
    harnesses: string[];
    environments: string[];
    readyPairs: string[];
    envFiles: { label: string; exists: boolean }[];
    credentials: {
      openRouter: boolean;
      openAiApiKey: boolean;
      e2b: boolean;
      daytona: boolean;
      codesandbox: boolean;
      vercel: boolean;
    };
    modelGateway: {
      provider: 'openrouter' | 'openai' | 'unconfigured';
      baseUrl: string | null;
      model: string | null;
    };
  };
  bos: {
    configured: boolean;
    authMode: 'none' | 'jwt' | 'service_email';
    status: 'offline' | 'needs_auth' | 'ready' | 'error';
    projectUrl: string | null;
    user: Record<string, unknown> | null;
    counts: Record<string, number>;
    rows: Record<string, Record<string, unknown>[]>;
    warnings: string[];
  };
}

export async function fetchArchitectureContext(email?: string, jwt?: string): Promise<ArchitectureContext> {
  const qs = email?.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
  const headers: Record<string, string> = {};
  if (jwt?.trim()) headers.Authorization = `Bearer ${jwt.trim()}`;
  const res = await fetch(`/architecture/context${qs}`, { headers });
  if (!res.ok) throw new Error(`architecture context failed: ${res.status}`);
  return (await res.json()) as ArchitectureContext;
}
