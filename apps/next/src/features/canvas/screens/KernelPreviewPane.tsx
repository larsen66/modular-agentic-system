import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '@/state/uiStore'
import { getKernelPreview, onKernelPreview, setKernelPreview } from '@/core/kernel'
import { runnerJson } from '@/core/runner'
import { EmptyState } from '@/shared/EmptyState'

// Kernel preview pane. The kernel surfaces a preview URL on the core/kernel bus from two events:
//   - `preview_ready`           → a LIVE sandbox URL (e.g. https://<port>-<id>.e2b.app), dies with
//                                 the sandbox.
//   - `preview_snapshot_ready`  → a DURABLE static snapshot at /preview/:sessionId/app/ (relative,
//                                 proxied to the kernel by Vercel), survives sandbox teardown.
// Both render here in an iframe. A slim toolbar adds reload + open-in-new-tab. The legacy canvas
// PreviewScreen (snapshot polling against the runner) is unused on the kernel path.
export function KernelPreviewPane({ sessionId: sessionIdProp }: { sessionId?: string | null } = {}) {
  // Prefer an explicit prop (CanvasPane threads the resolved session) and fall back to the UI store
  // so the registry-mounted variant still works standalone.
  const storeSessionId = useUiStore((s) => s.activeSessionId)
  const sessionId = sessionIdProp ?? storeSessionId
  const [url, setUrl] = useState<string | null>(null)
  // Bumped by Reload to force the iframe to refetch (cache-bust + remount via key).
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      setUrl(null)
      return
    }
    const fromBus = getKernelPreview(sessionId) ?? null
    setUrl(fromBus)
    // On a fresh page load the in-memory preview bus is empty (it's only filled by live run events).
    // Restore from the kernel's preview registry so the preview survives a refresh: GET
    // /preview/:sessionId returns { url (live), static (durable snapshot exists) }. Prefer the durable
    // snapshot as a RELATIVE path (Vercel rewrites /preview/* → kernel; avoids mixed-content from the
    // kernel's absolute http origin); fall back to the live url. Skipped if the bus already has it.
    let cancelled = false
    if (!fromBus) {
      void runnerJson<{ url: string | null; static: string | null }>(`/preview/${encodeURIComponent(sessionId)}`)
        .then((r) => {
          if (cancelled) return
          const restored = r.static ? `/preview/${encodeURIComponent(sessionId)}/app/` : r.url
          if (restored) {
            setUrl(restored)
            setKernelPreview(sessionId, restored)
          }
        })
        .catch(() => {})
    }
    const unsub = onKernelPreview((sid, u) => {
      if (sid === sessionId) setUrl(u)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [sessionId])

  // Absolute URL for open-in-new-tab (a relative snapshot path resolves against this origin, which
  // Vercel rewrites to the kernel). Live e2b URLs are already absolute and pass through unchanged.
  const absoluteUrl = useMemo(() => {
    if (!url) return null
    try {
      return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').toString()
    } catch {
      return url
    }
  }, [url])

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          title="No preview yet"
          description="Run something that builds and serves a port — the kernel surfaces its preview URL here."
        />
      </div>
    )
  }

  // Cache-bust on reload so the iframe refetches even when the URL is unchanged.
  const iframeSrc = reloadNonce > 0 ? `${url}${url.includes('?') ? '&' : '?'}_r=${reloadNonce}` : url

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          title="Reload preview"
          aria-label="Reload preview"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={absoluteUrl ?? url}>
          {absoluteUrl ?? url}
        </div>
        {absoluteUrl ? (
          <a
            href={absoluteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            aria-label="Open in new tab"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </a>
        ) : null}
      </div>
      <iframe
        key={reloadNonce}
        title="Kernel preview"
        src={iframeSrc}
        className="min-h-0 w-full flex-1 border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  )
}
