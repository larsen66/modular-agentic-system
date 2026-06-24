import { useCallback, useEffect, useRef, useState } from 'react'
import { RunnerError } from '@/core/runner'
import {
  clearDevBackoff,
  fetchSnapshot,
  fetchToken,
  kickBuilt,
  probeEviction,
  subscribeSnapshot,
  type PreviewSnapshotData,
} from '@/core/preview'
import { isNewerSnapshot, mapSnapshotToState, type PreviewState } from '../lib/previewState'
import { deriveStage } from '../lib/deriveStage'
import { buildPreviewUrl, cachedViewerPreflightUrl } from '../lib/previewUrl'
import type { LaunchDiagnostic, PreviewPaneState } from '../types'

// The canvas truth hook — island recreation of the legacy `usePreviewState` (canvas
// `preview-lifecycle` flow §3.1). Subscribes to the runner snapshot, applies the monotonic gate,
// derives the simplified `PreviewState` + a debounced token-bearing `previewUrl` + the
// launch-diagnostic, runs the 300s timeout and 120s auto-recovery timers, and exposes the action
// surface. Surface selection (built-vs-dev) stays backend-owned: the hook READS the snapshot fields
// and never decides the surface.
//
// Phase-2 scope: correctness over the carried POLL fallback (`core/preview.subscribeSnapshot`). The
// WS push happy-path, transport boundary events (port_reset/container_recovered/hmr_session_lost),
// and the cross-tab retry leader-election are wired in Phase 2b once the runner WS channel lands
// island-side; the poll + timers below cover correctness meanwhile.

const URL_DEBOUNCE_MS = 800
const PREVIEW_TIMEOUT_MS = 300_000
const AUTO_RECOVERY_MS = 120_000
const MAX_AUTO_RECOVERIES = 2

export interface UsePreviewOptions {
  enabled?: boolean
  hostWorkspaceId?: string | null
  surfaceKey?: string | null
  /** Backend swapped the session id in a snapshot — adopt without an iframe reset. */
  onSessionResolved?: (sessionId: string) => void
  /** Session is gone (404) — recreate via session-bootstrap. Bounded to once per session id. */
  onSessionInvalidated?: (reason: string) => void
}

export interface UsePreviewResult {
  state: PreviewPaneState
  previewUrl: string | null
  snapshot: PreviewSnapshotData | null
  diagnostic: LaunchDiagnostic
  /** Re-assign the iframe `.src` (cache-bust) + re-fetch the snapshot. */
  reload: () => void
  /** Force a fresh built build, then reload (run-completed rebuild). */
  buildAndReload: () => void
  /** Catch-up snapshot read (manual Retry from the error panel). */
  retry: () => void
  /** Restart — clears the dev backoff first when unavailable (BW218), then reloads. */
  restart: () => void
  /** Register the active iframe so boundary reloads can re-assign `.src` (load-bearing). */
  registerIframe: (el: HTMLIFrameElement | null) => void
  /** Iframe loaded a 426 → first-class router-upgrade state (set by the screen on the proxy block). */
  markRouterUpgrade: () => void
}

export function usePreview(
  stableSessionId: string | null,
  opts: UsePreviewOptions = {},
): UsePreviewResult {
  // `surfaceKey` is part of the options contract but consumed by the screen's iframe host (it drives
  // the snap-direct surface-change), not the hook itself.
  const { enabled = true, hostWorkspaceId, onSessionResolved, onSessionInvalidated } = opts

  const [snapshot, setSnapshot] = useState<PreviewSnapshotData | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [evicted, setEvicted] = useState(false)
  const [routerUpgrade, setRouterUpgrade] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  // Mutable bookkeeping (not render state).
  const lastAppliedRef = useRef<PreviewSnapshotData | null>(null)
  const tokenFetchKeyRef = useRef<string | null>(null) // single-flight key `previewPath:epoch`
  const invalidatedRef = useRef<Set<string>>(new Set()) // bounded 404 invalidation per session id
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const reloadNonceRef = useRef(0)
  const probedUrlRef = useRef<string | null>(null) // eviction probe is once-per-URL
  const autoRecoveryRef = useRef(0)
  const firstUrlRef = useRef(false) // first URL applies immediately; later changes debounce
  const previewUrlRef = useRef<string | null>(null)

  const registerIframe = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
  }, [])

  // Keep a fresh url for the imperative reload without re-creating `doReload` on every url change.
  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  // ── Actions (declared before the timers effect that calls them) ──
  const doReload = useCallback(() => {
    const el = iframeRef.current
    const url = previewUrlRef.current
    if (el && url) {
      reloadNonceRef.current += 1
      // `?_reload=<ts>` src-bump — can't `contentWindow.location.reload()` on a cross-origin frame.
      const sep = url.includes('?') ? '&' : '?'
      el.src = `${url}${sep}_reload=${reloadNonceRef.current}`
    }
    if (stableSessionId) {
      void fetchSnapshot(stableSessionId)
        .then((snap) => {
          if (snap && isNewerSnapshot(lastAppliedRef.current, snap, stableSessionId)) {
            lastAppliedRef.current = snap
            setSnapshot(snap)
          }
        })
        .catch(() => {})
    }
  }, [stableSessionId])

  const retry = useCallback(() => {
    setTimedOut(false)
    autoRecoveryRef.current = 0
    if (stableSessionId) {
      void fetchSnapshot(stableSessionId)
        .then((snap) => {
          if (snap) {
            lastAppliedRef.current = snap
            setSnapshot(snap)
          }
        })
        .catch(() => {})
    }
  }, [stableSessionId])

  const buildAndReload = useCallback(() => {
    if (!stableSessionId) return
    void kickBuilt(stableSessionId)
      .catch(() => {})
      .finally(doReload)
  }, [stableSessionId, doReload])

  const restart = useCallback(() => {
    if (!stableSessionId) return
    // Unavailable (dev 5-min backoff) → clear the backoff FIRST, else a refetch re-reads it (BW218).
    if (snapshot?.error?.code === 'preview_unavailable') {
      void clearDevBackoff(stableSessionId).finally(doReload)
      return
    }
    doReload()
  }, [stableSessionId, snapshot?.error?.code, doReload])

  const markRouterUpgrade = useCallback(() => setRouterUpgrade(true), [])

  // Reset on session change is handled by REMOUNTING the preview subtree on the `previewIdentityKey`
  // (host workspace + surface + session) at the screen — React's idiomatic "key to reset" — so this
  // hook starts fresh (state + refs) per session and needs no in-place reset effect. The monotonic
  // gate also rejects any stale snapshot whose `sessionId` differs (`isNewerSnapshot`).

  // ── Subscribe to snapshots (poll fallback; monotonic-gated apply) ──
  useEffect(() => {
    if (!stableSessionId || !enabled) return
    const sid = stableSessionId
    const unsub = subscribeSnapshot(
      sid,
      (snap) => {
        if (!isNewerSnapshot(lastAppliedRef.current, snap, sid)) return // stale → drop (load-bearing)
        lastAppliedRef.current = snap
        setSnapshot(snap)
        if (snap.sessionId !== sid) onSessionResolved?.(snap.sessionId) // backend id swap
      },
      {
        onError: (err) => {
          if (err instanceof RunnerError && err.status === 404 && !invalidatedRef.current.has(sid)) {
            invalidatedRef.current.add(sid)
            onSessionInvalidated?.('preview_snapshot_404')
          }
          // 401 / network → the poll keeps retrying (backoff is the subscribe seam's concern).
        },
      },
    )
    return unsub
  }, [stableSessionId, enabled, onSessionResolved, onSessionInvalidated])

  // ── Token fetch (single-flight, keyed previewPath:epoch — NOT builtAt; bounded 404) ──
  useEffect(() => {
    if (!stableSessionId || !enabled || !snapshot?.previewPath) return
    const sid = stableSessionId
    const key = `${snapshot.previewPath}:${snapshot.sessionEpoch}`
    if (tokenFetchKeyRef.current === key) return // already fetched/fetching for this path+epoch
    tokenFetchKeyRef.current = key
    let cancelled = false
    void fetchToken(sid)
      .then((t) => {
        if (!cancelled) setToken(t)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof RunnerError && err.status === 404 && !invalidatedRef.current.has(sid)) {
          invalidatedRef.current.add(sid) // a 404 token fetch can never succeed → invalidate once (PW97)
          onSessionInvalidated?.('preview_status_token_404')
        }
      })
    return () => {
      cancelled = true
    }
  }, [stableSessionId, enabled, snapshot?.previewPath, snapshot?.sessionEpoch, onSessionInvalidated])

  // ── Resolve the preview URL (cached-viewer preflight) + 800ms debounce ──
  const previewPath = snapshot?.previewPath ?? null
  const builtAt = snapshot?.built.lastBuiltAt ?? null
  const devRunNonce = snapshot?.devRunNonce ?? null
  const buildHash = snapshot?.built.buildHash ?? null
  const selectedSurface = snapshot?.selectedSurface
  const cachedViewerGated =
    !!buildHash && snapshot?.built.state === 'serving' && snapshot?.dev.state !== 'running'

  useEffect(() => {
    if (!previewPath || !token) {
      // Inputs gone → clear the URL immediately (flow §3.4). A legitimate synchronous clear.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null)
      firstUrlRef.current = false
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const resolve = async () => {
      let useCachedViewer = false
      if (cachedViewerGated && buildHash) {
        // HEAD preflight BEFORE committing — Chrome fires iframe onLoad even for cross-origin 404 bodies.
        try {
          const res = await fetch(cachedViewerPreflightUrl(previewPath, buildHash), { method: 'HEAD' })
          useCachedViewer = res.ok
        } catch {
          useCachedViewer = false
        }
      }
      if (cancelled) return
      const next = buildPreviewUrl({
        previewPath,
        previewToken: token,
        builtAt,
        devRunNonce,
        buildHash,
        selectedSurface,
        useCachedViewer,
        hostWorkspaceId,
      })
      if (!firstUrlRef.current) {
        firstUrlRef.current = true
        setPreviewUrl(next) // first URL applies immediately
      } else {
        timer = setTimeout(() => {
          if (!cancelled) setPreviewUrl(next)
        }, URL_DEBOUNCE_MS)
      }
    }
    void resolve()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [previewPath, token, builtAt, devRunNonce, buildHash, selectedSurface, cachedViewerGated, hostWorkspaceId])

  // ── Eviction probe (once-per-URL, fail-open) ──
  useEffect(() => {
    if (!previewUrl || probedUrlRef.current === previewUrl) return
    probedUrlRef.current = previewUrl
    let cancelled = false
    void probeEviction(previewUrl).then((r) => {
      if (!cancelled && r.evicted) setEvicted(true)
    })
    return () => {
      cancelled = true
    }
  }, [previewUrl])

  // ── Derived render state ──
  const baseState: PreviewState | 'no_session' = !stableSessionId
    ? 'no_session'
    : snapshot
      ? mapSnapshotToState(snapshot)
      : 'provisioning'
  let state: PreviewPaneState = baseState
  if (evicted) state = 'evicted'
  else if (routerUpgrade) state = 'router_upgrade'
  else if (timedOut && baseState !== 'ready') state = 'error'

  const isReadyWithUrl = baseState === 'ready' && !!previewUrl

  // ── Timers: 300s hard timeout + 120s auto-recovery (≤2) ──
  useEffect(() => {
    if (isReadyWithUrl || state === 'no_session') return
    const timeout = setTimeout(() => setTimedOut(true), PREVIEW_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [isReadyWithUrl, state])

  useEffect(() => {
    if (isReadyWithUrl || state === 'no_session' || state === 'evicted' || state === 'router_upgrade') return
    const recover = setTimeout(() => {
      if (autoRecoveryRef.current < MAX_AUTO_RECOVERIES) {
        autoRecoveryRef.current += 1
        doReload()
      } else {
        setTimedOut(true) // exhausted → surface error with manual retry
      }
    }, AUTO_RECOVERY_MS)
    return () => clearTimeout(recover)
  }, [isReadyWithUrl, state, doReload])

  const diagnostic: LaunchDiagnostic = {
    stage: deriveStage(snapshot?.progress?.phase),
    message: snapshot?.progress?.message ?? null,
    current: snapshot?.progress?.current ?? null,
    total: snapshot?.progress?.total ?? null,
  }

  return {
    state,
    previewUrl: isReadyWithUrl ? previewUrl : null,
    snapshot,
    diagnostic,
    reload: doReload,
    buildAndReload,
    retry,
    restart,
    registerIframe,
    markRouterUpgrade,
  }
}
