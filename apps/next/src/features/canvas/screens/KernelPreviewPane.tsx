import { useEffect, useState } from 'react'
import { useUiStore } from '@/state/uiStore'
import { getKernelPreview, onKernelPreview } from '@/core/kernel'
import { EmptyState } from '@/shared/EmptyState'

// Minimal kernel preview pane. The kernel emits `preview_ready { url }` inline on the run stream (it
// has no rich snapshot lifecycle like the legacy runner), captured into the core/kernel preview bus.
// This renders that URL in an iframe for the active session. The legacy canvas PreviewScreen (snapshot
// polling against the runner) is unused on the kernel path.
export function KernelPreviewPane({ sessionId: sessionIdProp }: { sessionId?: string | null } = {}) {
  // Prefer an explicit prop (CanvasPane threads the resolved session) and fall back to the UI store
  // so the registry-mounted variant still works standalone.
  const storeSessionId = useUiStore((s) => s.activeSessionId)
  const sessionId = sessionIdProp ?? storeSessionId
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setUrl(null)
      return
    }
    setUrl(getKernelPreview(sessionId) ?? null)
    return onKernelPreview((sid, u) => {
      if (sid === sessionId) setUrl(u)
    })
  }, [sessionId])

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

  return (
    <iframe
      title="Kernel preview"
      src={url}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  )
}
