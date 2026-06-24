import { runnerFetch, runnerJson, RunnerError } from './runner'

// Preview access-layer seam (canvas area). Island-side recreation of the runner preview contract —
// the typed operations the canvas `preview-lifecycle` flow drives. We reuse the SAME runner-service
// endpoints as the legacy app via `core/runner.ts`; this is the seam, not legacy React.
//
// Contract source (keep in sync): `runner-service/src/sessions/PreviewSnapshot.ts` (the snapshot
// shape) + `runner-service/src/routes/preview.routes.ts` (the endpoints). The snapshot TYPE lives
// here in the access layer (like `SessionResponse` in runnerSession.ts) because it is the backend
// contract; the island-derived render state + URL building live in `features/canvas/lib/**`.

// ── Snapshot contract (mirror of runner-service/src/sessions/PreviewSnapshot.ts) ──

export type PreviewSurface = 'built' | 'dev' | 'none'

export type PreviewStatus =
  | 'empty'
  | 'provisioning'
  | 'ready'
  | 'degraded'
  | 'container_dead'
  | 'expired'
  | 'error'

export type BuiltPreviewState = 'idle' | 'building' | 'serving' | 'failed' | 'stale'
export type DevServerState = 'idle' | 'starting' | 'running' | 'failed' | 'killed' | 'skipped'

export type SnapshotReason =
  | 'built_serving'
  | 'built_fallback'
  | 'dev_running'
  | 'warming_up'
  | 'surface_conflict'
  | 'container_dead'
  | 'session_expired'
  | 'preview_error'
  | 'no_preview_surface'

export type PreviewProgressPhase =
  | 'materializing'
  | 'workspace-cloned'
  | 'creating'
  | 'prebuild-hit'
  | 'install-skipped'
  | 'dependencies'
  | 'dist-cache-miss'
  | 'built-building'
  | 'built-failed'
  | 'built_building'
  | 'built_healthcheck'
  | 'dev_starting'
  | 'session-evicted'
  | 'ready'
  | 'recovering'
  | 'idle'
  | 'error'

export type PreviewErrorCode =
  | 'container_dead'
  | 'preview_unavailable'
  | 'auth_failed'
  | 'built_failed'
  | 'dev_failed'
  | 'unknown'

export interface PreviewSnapshotData {
  sessionId: string
  version: number
  sessionEpoch: number
  emittedAt: number
  runtime: 'local' | 'docker'

  status: PreviewStatus
  selectedSurface: PreviewSurface
  reason: SnapshotReason

  previewPath: string | null
  port: number | null

  container: { id: string | null; alive: boolean; canRestart: boolean }

  built: {
    state: BuiltPreviewState
    port: 4173 | null
    healthy: boolean
    source: 'none' | 'cache' | 'fresh' | 'restored'
    buildStartedAt: number | null
    lastBuiltAt: number | null
    /** Content-addressed dist hash for the immutable cached-viewer URL (ADR 0053); null → dev path. */
    buildHash: string | null
    error: string | null
  }

  dev: {
    state: DevServerState
    port: number | null
    healthy: boolean
    startedAt: number | null
    lastConfirmedAt: number | null
    failureCount: number
    nextRetryAt: number | null
    error: string | null
  }

  progress: {
    phase: PreviewProgressPhase
    message: string | null
    current: number | null
    total: number | null
    unit: 'files' | 'steps' | null
  } | null

  timedOut: boolean
  /** Nonce bumped on each dev-server run → forces an iframe reload (`_r` cache-bust). */
  devRunNonce?: number | null

  error: { code: PreviewErrorCode; message: string; retriable: boolean } | null
}

// ── Token contract (GET /sessions/:id/preview/status) ──

export interface PreviewStatusResponse {
  previewToken?: string
  sessionStatus?: string
  builtPreviewState?: BuiltPreviewState
}

/** Result of an eviction side-channel probe. `evicted` is true ONLY for the augmented-404 marker. */
export interface EvictionProbeResult {
  evicted: boolean
  reason?: string
  evictedAt?: number | null
}

// ── Operations (over core/runner.ts) ──

/**
 * Reconnect catch-up / poll-fallback snapshot read. `GET /sessions/:id/preview/snapshot`.
 * Returns `null` for **204** (no snapshot yet — provisioning, NOT an error). Throws `RunnerError`
 * (status 401/404/…) on failure so the caller can run the backoff / invalidation paths (flow §4).
 */
export async function fetchSnapshot(sessionId: string, signal?: AbortSignal): Promise<PreviewSnapshotData | null> {
  const path = `/sessions/${encodeURIComponent(sessionId)}/preview/snapshot`
  console.log('[preview:fetchSnapshot] GET', path, '→ RUNNER_URL prefix in runner.ts')
  const res = await runnerFetch(path, {
    headers: { Accept: 'application/json' },
    signal,
  })
  console.log('[preview:fetchSnapshot] status', res.status, res.url)
  if (res.status === 204) return null
  const text = await res.text()
  const body = text ? safeJson(text) : null
  if (!res.ok) {
    const b = body as { error?: string; message?: string } | null
    throw new RunnerError(b?.message || b?.error || `preview snapshot failed (${res.status})`, res.status, body)
  }
  // Runner wraps the snapshot: { type: 'preview_snapshot', data: <PreviewSnapshotData> }
  const wrapped = body as { type?: string; data?: unknown } | null
  const snap = (wrapped?.type === 'preview_snapshot' && wrapped.data) ? wrapped.data : body
  return snap as PreviewSnapshotData
}

/**
 * HMAC preview token (≈12h). `GET /sessions/:id/preview/status`. Returns the token or `null` when
 * absent. **404 = truly-gone** (caller invalidates — bounded to once per session id, flow §4).
 */
export async function fetchToken(sessionId: string, signal?: AbortSignal): Promise<string | null> {
  const body = await runnerJson<PreviewStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/preview/status`,
    { headers: { Accept: 'application/json' }, signal },
  )
  return body.previewToken ?? null
}

/** Force a fresh built build (run-completed rebuild). `POST /sessions/:id/preview/kick-built`. */
export async function kickBuilt(sessionId: string): Promise<void> {
  await runnerFetch(`/sessions/${encodeURIComponent(sessionId)}/preview/kick-built`, { method: 'POST' })
}

/** Escape the 5-min dev backoff window on Restart-when-unavailable (BW218). */
export async function clearDevBackoff(sessionId: string): Promise<void> {
  await runnerFetch(`/sessions/${encodeURIComponent(sessionId)}/preview/clear-dev-backoff`, { method: 'POST' })
}

/**
 * Once-per-URL eviction side-channel probe. **Fail-open**: a generic 404 (dev proxy cold-handoff) is
 * NOT eviction — only an augmented 404 carrying the eviction marker counts (flow §4, load-bearing).
 * Never throws — any network/CORS/abort error resolves to `{ evicted: false }`.
 */
export async function probeEviction(previewUrl: string, signal?: AbortSignal): Promise<EvictionProbeResult> {
  try {
    const res = await fetch(previewUrl, { headers: { Accept: 'application/json' }, signal })
    if (res.status !== 404) return { evicted: false }
    const reasonHeader = res.headers.get('X-Session-Reason') ?? ''
    if (!reasonHeader.startsWith('evicted')) return { evicted: false } // generic 404 → fail open
    const body = (await res.json().catch(() => null)) as { reason?: string; evictedAt?: number } | null
    return {
      evicted: true,
      reason: body?.reason ?? (reasonHeader.replace(/^evicted_?/, '') || 'unknown'),
      evictedAt: body?.evictedAt ?? null,
    }
  } catch {
    return { evicted: false }
  }
}

/**
 * Subscribe to preview snapshots for a session. The happy path is a WS push (`preview_snapshot`);
 * until that channel is wired island-side this uses the carried **poll fallback** (flow §3.1, §4):
 * an immediate catch-up read then a self-stopping poll. Returns an unsubscribe fn.
 *
 * `onSnapshot` receives every successful snapshot (null 204s are skipped); `onError` receives the
 * `RunnerError` (the caller owns backoff / 401-health-check / 404-invalidation per flow §4).
 */
export function subscribeSnapshot(
  sessionId: string,
  onSnapshot: (snap: PreviewSnapshotData) => void,
  opts: { intervalMs?: number; onError?: (err: unknown) => void } = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 1500
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const snap = await fetchSnapshot(sessionId, controller.signal)
      console.log('[preview:snapshot]', sessionId.slice(0, 8), snap ? snap.status : '204-no-snap', snap)
      if (snap) onSnapshot(snap)
    } catch (err) {
      console.error('[preview:snapshot] ERROR', sessionId.slice(0, 8), err)
      if (!stopped) opts.onError?.(err)
    }
    if (!stopped) timer = setTimeout(tick, intervalMs)
  }
  void tick()

  return () => {
    stopped = true
    controller.abort()
    if (timer) clearTimeout(timer)
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ── Additional exports required by canvas hooks ───────────────────────────────────────────────

/** Preview metadata for a selected app/chat node. */
export interface PreviewMetadata {
  appId: string
  appName?: string | null
  chatId?: string | null
  runnerSessionId?: string | null
  opencodeSessionId?: string | null
  status: 'no-session' | 'provisioning' | 'ready' | 'error' | string
  previewUrl?: string | null
}

/** Fetch preview metadata for an app node. Returns a stub response if no session exists yet. */
export async function fetchPreviewMetadata(params: {
  appId: string
  chatId?: string | null
  appName?: string | null
}): Promise<PreviewMetadata> {
  return {
    appId: params.appId,
    appName: params.appName ?? null,
    chatId: params.chatId ?? null,
    runnerSessionId: null,
    opencodeSessionId: null,
    status: 'no-session',
    previewUrl: null,
  }
}
