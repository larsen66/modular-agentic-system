// Run-session lifecycle (distinct from the Supabase auth session in core/session.ts).
// Island-side recreation of the legacy session contract: a per-(project[,chat]) workspace container
// the chat run executes in. Contract source: legacy `src/hooks/chat/useSession.ts`,
// `src/lib/buildCreateSessionRequest.ts`, `src/lib/studioVocabulary.ts`; runner
// `runner-service/src/routes/sessions.routes.ts`.

export type RunnerSessionStatus =
  | 'created'
  | 'provisioning'
  | 'ready'
  | 'hibernated'
  | 'degraded'
  | 'error'
  | 'destroyed'

export interface SessionReadiness {
  npmReady: boolean
  aiReady: boolean
  /** The ONLY readiness truth for chat admission (legacy useSession §). */
  chatAccepting: boolean
}

export interface SessionLifecycleSnapshot {
  sessionId: string
  /** Monotonic — reject any snapshot whose version <= the last applied. */
  stateVersion: number
  updatedAt: string | null
  status: RunnerSessionStatus
  provisioningPhase: string | null
  readiness: SessionReadiness
  recovery: { state: 'idle' | 'recovering' | 'exhausted'; attempts: number }
  degradedReason: string | null
  errorMessage: string | null
}

export interface SessionResponse {
  id: string
  status: RunnerSessionStatus
  runtime?: string
  chatAccepting?: boolean
  aiReady?: boolean
  reused?: boolean
  surfaceKey?: string | null
  hostWorkspaceId?: string | null
  lifecycle?: SessionLifecycleSnapshot
  [k: string]: unknown
}

/** Coarse provisioning stage for the UI (legacy `studioVocabulary.ts` mapping). */
export type SessionProvisioningStage =
  | 'creating'
  | 'installing'
  | 'preview'
  | 'ready'
  | 'recovering'
  | 'error_exhausted'

export interface CreateSessionRequest {
  projectId: string
  chatId?: string | null
  surfaceKey?: string | null
  hostWorkspaceId?: string | null
  /** Adopt a pre-warmed/speculative session id. */
  sessionId?: string | null
}

// The kernel is stateless: there is no container to provision. `sessionId` is just a stable string
// the kernel scopes to the authed owner and uses for per-chat memory continuity. So the whole
// "create → poll until ready" dance collapses to synthesizing an immediately-ready snapshot.

function readySession(id: string): SessionResponse {
  return {
    id,
    status: 'ready',
    runtime: 'kernel',
    chatAccepting: true,
    aiReady: true,
    reused: false,
    lifecycle: {
      sessionId: id,
      stateVersion: 1,
      updatedAt: null,
      status: 'ready',
      provisioningPhase: 'ready',
      readiness: { npmReady: true, aiReady: true, chatAccepting: true },
      recovery: { state: 'idle', attempts: 0 },
      degradedReason: null,
      errorMessage: null,
    },
  }
}

/** "Create" the run session — synthesize a ready session keyed stably by chat (falls back to the
 *  project) so the kernel keeps memory continuity per chat. No runner container, no network. */
export async function createSession(
  req: CreateSessionRequest,
  _opts?: { runId?: string },
): Promise<SessionResponse> {
  const id = req.sessionId || req.chatId || `project-${req.projectId}`
  return readySession(id)
}

/** Poll the session. Kernel mode: always ready (no container lifecycle to track). */
export async function getSession(id: string): Promise<SessionResponse> {
  return readySession(id)
}

/** End/cleanup. Kernel mode: nothing to tear down. */
export async function endSession(_id: string): Promise<void> {
  /* no-op — the kernel holds no per-session container */
}

const CREATING_PHASES = new Set(['materializing', 'workspace-cloned', 'creating', ''])
const INSTALLING_PHASES = new Set(['dependencies', 'prebuild-hit', 'install-skipped'])
const PREVIEW_PHASES = new Set([
  'dist-cache-miss',
  'built-building',
  'built-failed',
  'ai-tools',
  'ai-ready',
  'dev-server',
])
const READY_PHASES = new Set(['ready', 'dev-server-ready'])

/** Map a lifecycle snapshot to the coarse provisioning stage shown in the UI. */
export function mapProvisioningStage(
  snap: SessionLifecycleSnapshot | undefined | null,
): SessionProvisioningStage | null {
  if (!snap) return null
  if (snap.status === 'error' && snap.recovery?.state === 'exhausted') return 'error_exhausted'
  if (snap.status === 'error' && snap.recovery?.state === 'recovering') return 'recovering'
  if (snap.readiness?.chatAccepting) return 'ready'
  const phase = snap.provisioningPhase ?? ''
  if (READY_PHASES.has(phase)) return 'ready'
  if (PREVIEW_PHASES.has(phase)) return 'preview'
  if (INSTALLING_PHASES.has(phase)) return 'installing'
  if (CREATING_PHASES.has(phase)) return 'creating'
  return 'creating'
}

/** True when the session can accept a chat run. */
export function isChatAccepting(s: SessionResponse): boolean {
  return Boolean(s.lifecycle?.readiness?.chatAccepting ?? s.chatAccepting)
}
