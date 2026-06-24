import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  HOST_ORIGIN,
  INIT_ACK_TIMEOUT_MS,
  MAX_INIT_ATTEMPTS,
  PROTOCOL_VERSION,
  bakedIframeSrc,
  mintInitPayload,
  resolveAppNode,
  resolveMaterializedMount,
} from '@/core/childMount'
import { getAgentStudioRuntime } from '@/core/runtime'
import { RUNNER_URL } from '@/core/runner'
import { getAccessToken } from '@/core/session'
import { useUiStore } from '@/state/uiStore'
import type {
  ChildMountState,
  ChildMountViewState,
  UseChildAppMountOptions,
  UseChildAppMountResult,
} from '../types/child-app-mount'

// The child-app-handshake hook (canvas `child-app-handshake` flow). Owns the mount FSM: resolve node
// by slug+runtime → pick baked/materialized → (materialized) attach runner → mount iframe → post
// `AOS_INIT` with a FRESH JWT per attempt (`targetOrigin = iframeOrigin`, never '*') → await
// `AOS_INIT_ACK` (origin + mountId + version checked) → `ready`, with a 5s × 3-attempt retry loop →
// `failed`. Posts `AOS_HOST_LANGUAGE_CHANGED` after the handshake when the host language changes.
//
// The L1 security contract is enforced in `core/childMount.mintInitPayload` (publishable key + user
// JWT only; never service_role). This hook NEVER targets origin '*' and rejects ACKs from any other
// origin/mount/version (defense-in-depth; the JWT is the real auth boundary). The screen renders the
// resting view; this hook owns all the mechanics.

// ── Reducer ──

type Action =
  | { type: 'reset' }
  | { type: 'no-such-app' }
  | { type: 'misconfigured'; detail?: string }
  | { type: 'no-session' }
  | { type: 'attaching'; mountId: string }
  | { type: 'iframe-loading'; src: string; origin: string; mountId: string; mode: 'baked' | 'materialized' }
  | { type: 'init-sent'; attempt: number }
  | { type: 'ready' }
  | { type: 'failed'; detail?: string }

const INITIAL: ChildMountState = {
  status: 'loading-node',
  iframeSrc: null,
  iframeOrigin: null,
  mountId: null,
  mode: null,
  attempt: 0,
}

function reducer(state: ChildMountState, action: Action): ChildMountState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL }
    case 'no-such-app':
      return { ...INITIAL, status: 'no-such-app' }
    case 'misconfigured':
      return { ...INITIAL, status: 'misconfigured', detail: action.detail }
    case 'no-session':
      return { ...state, status: 'no-session' }
    case 'attaching':
      return { ...state, status: 'attaching-runner', mountId: action.mountId, mode: 'materialized' }
    case 'iframe-loading':
      return {
        ...state,
        status: 'iframe-loading',
        iframeSrc: action.src,
        iframeOrigin: action.origin,
        mountId: action.mountId,
        mode: action.mode,
        attempt: 0,
      }
    case 'init-sent':
      return { ...state, status: 'init-sent', attempt: action.attempt }
    case 'ready':
      return { ...state, status: 'ready' }
    case 'failed':
      return { ...state, status: 'failed', detail: action.detail }
    default:
      return state
  }
}

// ── View projection (FSM → resting view the screen renders) ──

function toView(state: ChildMountState): ChildMountViewState {
  switch (state.status) {
    case 'ready':
      return { kind: 'ready' }
    case 'no-such-app':
      return { kind: 'error', reason: 'no-such-app' }
    case 'misconfigured':
      return { kind: 'error', reason: 'misconfigured', detail: state.detail }
    case 'no-session':
      return { kind: 'error', reason: 'no-session' }
    case 'failed':
      return { kind: 'error', reason: 'failed', detail: state.detail }
    case 'attaching-runner':
      return { kind: 'loading', phase: 'attaching-runner' }
    case 'iframe-loading':
    case 'init-sent':
      return { kind: 'loading', phase: 'handshaking' }
    case 'loading-node':
    default:
      return { kind: 'loading', phase: 'loading-node' }
  }
}

// ── ACK validation (defense-in-depth predicate; pure) ──

interface AosInitAck {
  type: string
  version: number
  mountId: string
}

function isValidAck(
  event: MessageEvent,
  expectedOrigin: string,
  expectedMountId: string,
): boolean {
  if (event.origin !== expectedOrigin) return false
  const data = event.data as Partial<AosInitAck> | null
  if (!data || data.type !== 'AOS_INIT_ACK') return false
  if (data.version !== PROTOCOL_VERSION) return false
  if (data.mountId !== expectedMountId) return false
  return true
}

// ── Hook ──

export function useChildAppMount(
  appSlug: string,
  opts: UseChildAppMountOptions = {},
): UseChildAppMountResult {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const [reloadNonce, setReloadNonce] = useState(0)
  const hostLanguage = useUiStore((s) => s.language)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const stateRef = useRef(state)
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hostLanguageRef = useRef(hostLanguage)
  const busyRef = useRef(false)
  // Holds the latest `sendInit` so the ACK-timeout retry can call it without a self-reference (TDZ).
  const sendInitRef = useRef<(attempt: number) => void>(() => {})

  // Sync refs after commit (not during render) — read by the async handshake callbacks.
  useEffect(() => {
    stateRef.current = state
    hostLanguageRef.current = hostLanguage
  })

  const registerIframe = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
  }, [])

  const clearAckTimer = useCallback(() => {
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current)
      ackTimerRef.current = undefined
    }
  }, [])

  // Send AOS_INIT with a FRESH JWT (token may rotate between attempts — load-bearing). Starts the 5s
  // ACK timer; on timeout, retry (attempt+1) up to MAX_INIT_ATTEMPTS, then `failed`.
  const sendInit = useCallback(
    async (attempt: number) => {
      const s = stateRef.current
      const win = iframeRef.current?.contentWindow
      if (!win || !s.iframeOrigin || !s.mountId) {
        dispatch({ type: 'failed', detail: 'no_content_window' })
        return
      }
      const payload = await mintInitPayload({
        mountId: s.mountId,
        hostLanguage: hostLanguageRef.current,
        runnerServiceUrl: s.mode === 'materialized' ? RUNNER_URL : undefined,
      })
      if (!payload) {
        dispatch({ type: 'no-session' })
        return
      }
      // NEVER targetOrigin '*'. baked → HOST_ORIGIN; materialized → resolved preview origin.
      win.postMessage(payload, s.iframeOrigin)
      dispatch({ type: 'init-sent', attempt })

      clearAckTimer()
      ackTimerRef.current = setTimeout(() => {
        const next = attempt + 1
        if (next >= MAX_INIT_ATTEMPTS) {
          dispatch({ type: 'failed', detail: 'no_ack_after_retries' })
        } else {
          sendInitRef.current(next)
        }
      }, INIT_ACK_TIMEOUT_MS)
    },
    [clearAckTimer],
  )

  // Keep the retry pointer fresh (sendInit recreates only when clearAckTimer changes — effectively once).
  useEffect(() => {
    sendInitRef.current = sendInit
  }, [sendInit])

  // iframe `load` — kick the handshake (baked waits for the same-origin load; materialized also gets
  // a load once the proxied frame renders). Only fires the FIRST send (status still `iframe-loading`).
  const onIframeLoad = useCallback(() => {
    if (stateRef.current.status === 'iframe-loading') void sendInit(0)
  }, [sendInit])

  // Resolution effect — runs on [appSlug, runtime, reloadNonce]; cancelled-guard on unmount/reload.
  const runtime = opts.runtimeOverride ?? getAgentStudioRuntime()
  useEffect(() => {
    let cancelled = false
    busyRef.current = true
    dispatch({ type: 'reset' })

    void (async () => {
      const resolved = await resolveAppNode(appSlug, runtime)
      if (cancelled) return
      if (!resolved) {
        busyRef.current = false
        dispatch({ type: 'no-such-app' })
        return
      }
      const mountId = resolved.node.id

      if (resolved.mode === 'misconfigured') {
        busyRef.current = false
        dispatch({ type: 'misconfigured', detail: resolved.reason })
        return
      }

      if (resolved.mode === 'baked') {
        const src = bakedIframeSrc(resolved.bakedMountPath ?? `/internal/${appSlug}/`, mountId)
        busyRef.current = false
        dispatch({ type: 'iframe-loading', src, origin: HOST_ORIGIN, mountId, mode: 'baked' })
        return // baked kicks AOS_INIT on the iframe `load` event (onIframeLoad)
      }

      // materialized — needs a session, then attach + poll.
      const token = await getAccessToken()
      if (cancelled) return
      if (!token) {
        busyRef.current = false
        dispatch({ type: 'no-session' })
        return
      }
      dispatch({ type: 'attaching', mountId })
      try {
        const mount = await resolveMaterializedMount({
          appNodeId: mountId,
          platformJwt: token,
          runnerUrl: RUNNER_URL,
          fetchImpl: opts.fetchImpl,
          maxPreviewStatusAttempts: opts.maxPreviewStatusAttempts,
          previewStatusPollIntervalMs: opts.previewStatusPollIntervalMs,
        })
        if (cancelled) return
        busyRef.current = false
        dispatch({
          type: 'iframe-loading',
          src: mount.previewUrl,
          origin: mount.iframeOrigin,
          mountId,
          mode: 'materialized',
        })
      } catch (err) {
        if (cancelled) return
        busyRef.current = false
        dispatch({ type: 'failed', detail: err instanceof Error ? err.message : 'resolver_failed' })
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSlug, runtime, reloadNonce])

  // ACK listener — set up ONCE (survives transitions via stateRef); rejects bad origin/mount/version.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const s = stateRef.current
      if (s.status !== 'init-sent') return
      if (!s.iframeOrigin || !s.mountId) return
      if (!isValidAck(event, s.iframeOrigin, s.mountId)) return
      clearAckTimer()
      dispatch({ type: 'ready' })
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      clearAckTimer()
    }
  }, [clearAckTimer])

  // Post-handshake live language change → AOS_HOST_LANGUAGE_CHANGED (same iframeOrigin, never '*').
  useEffect(() => {
    const s = stateRef.current
    if (s.status !== 'init-sent' && s.status !== 'ready') return
    const win = iframeRef.current?.contentWindow
    if (!win || !s.iframeOrigin || !s.mountId) return
    win.postMessage(
      { type: 'AOS_HOST_LANGUAGE_CHANGED', version: PROTOCOL_VERSION, mountId: s.mountId, hostLanguage },
      s.iframeOrigin,
    )
  }, [hostLanguage])

  const reload = useCallback(() => {
    busyRef.current = true
    dispatch({ type: 'reset' })
    // Bump the nonce → the resolution effect re-runs from `loading-node`.
    setReloadNonce((n) => n + 1)
  }, [])

  const view = toView(state)
  return {
    view,
    iframeSrc: state.iframeSrc,
    registerIframe,
    onIframeLoad,
    reload,
    // Derived from the view (no ref read during render); the in-flight guard itself stays in busyRef.
    busy: view.kind === 'loading',
  }
}
