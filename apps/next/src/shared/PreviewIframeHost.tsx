import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessToken } from '@/core/session'
import { useUiStore } from '@/state/uiStore'

// Two-buffer preview iframe host. Two iframes are permanently mounted; activeSlot ('a'|'b')
// determines which is visible. Promotion = CSS flip — the pre-loaded candidate becomes visible
// instantly with no new network request. On promotion the OLD active slot is cleared so it
// doesn't leak back as a stale candidate and cause infinite back-and-forth.
//
// PostMessage protocols (host→iframe):
//   mount-config — fires on every iframe onLoad; carries surface identity + auth token.
// PostMessage protocols (iframe→host):
//   app:ready / crm:ready — triggers instant candidate promotion.
//   __clovedDevtools      — HMR bridge: forwarded into the active iframe.

const CANDIDATE_AUTOPROMOTE_GRACE_MS = 1500
const CANDIDATE_TIMEOUT_MS = 10000

export interface PreviewIframeHostProps {
  url: string | null
  hostWorkspaceId?: string | null
  surfaceKey?: string | null
  title: string
  onRegisterIframe?: (el: HTMLIFrameElement | null) => void
  onHandoffChange?: (handingOff: boolean) => void
  onRouterUpgrade?: () => void
}

export function PreviewIframeHost({
  url,
  hostWorkspaceId,
  surfaceKey,
  title,
  onRegisterIframe,
  onHandoffChange,
  onRouterUpgrade,
}: PreviewIframeHostProps) {
  const [slotA, setSlotA] = useState<string | null>(url)
  const [slotB, setSlotB] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a')
  const [, setHandingOff] = useState(false)

  const refA = useRef<HTMLIFrameElement | null>(null)
  const refB = useRef<HTMLIFrameElement | null>(null)
  // Keep a ref in sync with state so promote() never reads a stale activeSlot.
  const activeSlotRef = useRef<'a' | 'b'>('a')
  activeSlotRef.current = activeSlot

  const language = useUiStore((s) => s.language)

  const isAActive = activeSlot === 'a'
  const activeUrl  = isAActive ? slotA : slotB
  const candidateUrl = isAActive ? slotB : slotA
  const activeRef    = isAActive ? refA : refB
  const candidateRef = isAActive ? refB : refA

  // Stable refs so async callbacks never close over stale props.
  const surfaceKeyRef      = useRef(surfaceKey)
  const hostWorkspaceIdRef = useRef(hostWorkspaceId)
  const languageRef        = useRef(language)
  const activeUrlRef       = useRef(activeUrl)
  const slotAUrlRef        = useRef(slotA)
  const slotBUrlRef        = useRef(slotB)
  useEffect(() => { surfaceKeyRef.current = surfaceKey },           [surfaceKey])
  useEffect(() => { hostWorkspaceIdRef.current = hostWorkspaceId }, [hostWorkspaceId])
  useEffect(() => { languageRef.current = language },               [language])
  useEffect(() => { activeUrlRef.current = activeUrl },             [activeUrl])
  useEffect(() => { slotAUrlRef.current = slotA },                  [slotA])
  useEffect(() => { slotBUrlRef.current = slotB },                  [slotB])

  // ── Render-time URL routing ───────────────────────────────────────────────
  // React's state-adjustment pattern: derive which slot gets the new URL synchronously,
  // without an effect (avoids a one-frame flicker on first load).
  const currentSurface = `${hostWorkspaceId ?? ''}::${surfaceKey ?? ''}`
  const [prevInput, setPrevInput] = useState<{ url: string | null; surface: string }>({
    url,
    surface: currentSurface,
  })

  if (url !== prevInput.url || currentSurface !== prevInput.surface) {
    const surfaceChanged = currentSurface !== prevInput.surface
    setPrevInput({ url, surface: currentSurface })

    if (url === null) {
      setSlotA(null)
      setSlotB(null)
    } else if (!activeUrl || surfaceChanged) {
      // First load or surface change → snap directly into the active slot.
      if (activeSlot === 'a') { setSlotA(url); setSlotB(null) }
      else                    { setSlotB(url); setSlotA(null) }
    } else if (url !== activeUrl && url !== candidateUrl) {
      // Same surface, new URL → warm the candidate slot.
      if (activeSlot === 'a') setSlotB(url)
      else                    setSlotA(url)
    }
  }

  // ── Promote: CSS flip + clear the old active slot ────────────────────────
  // Clearing the old active slot is load-bearing: without it, the slot retains the old URL
  // and appears as a non-null candidateUrl after the flip, triggering a re-promote loop.
  const promote = useCallback(() => {
    const prev = activeSlotRef.current
    if (prev === 'a') setSlotA(null)   // A was active → becomes candidate → clear it
    else              setSlotB(null)   // B was active → becomes candidate → clear it
    setActiveSlot(prev === 'a' ? 'b' : 'a')
    setHandingOff(false)
  }, [])

  // ── Candidate lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (!candidateUrl) {
      onHandoffChange?.(false)
      return
    }
    onHandoffChange?.(true)
    setHandingOff(true)

    let promoted = false
    const candidateOrigin = safeOrigin(candidateUrl)

    const onMessage = (e: MessageEvent) => {
      if (promoted) return
      if (candidateRef.current && e.source !== candidateRef.current.contentWindow) return
      if (candidateOrigin && e.origin !== candidateOrigin) return
      const type = (e.data as { type?: string } | null)?.type
      if (type === 'app:ready' || type === 'crm:ready') {
        promoted = true
        promote()
      }
    }
    window.addEventListener('message', onMessage)

    const autoPromote = setTimeout(() => {
      if (!promoted) { promoted = true; promote() }
    }, CANDIDATE_AUTOPROMOTE_GRACE_MS)

    // Broken candidate URL: discard after timeout, keep showing the active frame.
    const discard = setTimeout(() => {
      if (!promoted) {
        if (activeSlotRef.current === 'a') setSlotB(null)
        else                               setSlotA(null)
        setHandingOff(false)
      }
    }, CANDIDATE_TIMEOUT_MS)

    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(autoPromote)
      clearTimeout(discard)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateUrl])

  // ── HMR bridge (Contract C) ───────────────────────────────────────────────
  // Forward __clovedDevtools messages from the dev server into the active iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const activeEl = activeSlotRef.current === 'a' ? refA.current : refB.current
      const activeU  = activeUrlRef.current
      if (!activeEl?.contentWindow || !activeU) return
      const data = e.data as { __clovedDevtools?: unknown } | null
      if (!data?.__clovedDevtools) return
      activeEl.contentWindow.postMessage(e.data, safeOrigin(activeU) ?? '*')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── Register active iframe ref ────────────────────────────────────────────
  useEffect(() => {
    onRegisterIframe?.(activeRef.current)
    return () => onRegisterIframe?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot, activeUrl])

  // ── mount-config sender ───────────────────────────────────────────────────
  const sendMountConfig = useCallback(
    (el: HTMLIFrameElement | null, u: string | null) => {
      if (!el?.contentWindow || !u) return
      const origin = safeOrigin(u) ?? '*'
      void getAccessToken().catch(() => null).then((token) => {
        if (!el.contentWindow) return
        el.contentWindow.postMessage(
          {
            type: 'mount-config',
            surfaceKey: surfaceKeyRef.current ?? null,
            authority: hostWorkspaceIdRef.current ?? null,
            principal: token,
            hostLanguage: languageRef.current,
          },
          origin,
        )
      })
    },
    [],
  )

  const onLoadA = useCallback(() => sendMountConfig(refA.current, slotAUrlRef.current), [sendMountConfig])
  const onLoadB = useCallback(() => sendMountConfig(refB.current, slotBUrlRef.current), [sendMountConfig])

  // ── 426 router-upgrade detector ───────────────────────────────────────────
  const onActiveError = useCallback(() => {
    const el = activeSlotRef.current === 'a' ? refA.current : refB.current
    if (!el) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((el.contentDocument as any)?.defaultView?.location?.status === 426) onRouterUpgrade?.()
    } catch { /* cross-origin */ }
  }, [onRouterUpgrade])

  return (
    <div className="relative h-full min-h-0 w-full">
      {slotA ? (
        <iframe
          ref={refA}
          src={slotA}
          title={isAActive ? title : `${title} (loading)`}
          aria-hidden={!isAActive}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-150${isAActive ? ' opacity-100' : ' pointer-events-none opacity-0'}`}
          onLoad={onLoadA}
          onError={isAActive ? onActiveError : undefined}
          data-testid={isAActive ? 'canvas-preview-iframe' : 'canvas-preview-candidate'}
        />
      ) : null}
      {slotB ? (
        <iframe
          ref={refB}
          src={slotB}
          title={!isAActive ? title : `${title} (loading)`}
          aria-hidden={isAActive}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-150${!isAActive ? ' opacity-100' : ' pointer-events-none opacity-0'}`}
          onLoad={onLoadB}
          onError={!isAActive ? onActiveError : undefined}
          data-testid={!isAActive ? 'canvas-preview-iframe' : 'canvas-preview-candidate'}
        />
      ) : null}
    </div>
  )
}

function safeOrigin(u: string): string | null {
  try {
    return new URL(u, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').origin
  } catch {
    return null
  }
}
