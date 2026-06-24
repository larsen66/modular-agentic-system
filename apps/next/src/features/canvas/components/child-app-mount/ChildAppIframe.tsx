import { useEffect, useRef } from 'react'
import type { ChildAppIframeProps } from '../../types/child-app-mount'

// The L1 child-app iframe host (canvas `child-app-mount`). A SINGLE stable iframe element kept mounted
// across `iframe-loading | init-sent | ready` (no remount mid-handshake — the canvas-shell
// `previewIdentityKey` owns cross-surface remount). It registers its element with the hook so the
// handshake can `postMessage(AOS_INIT, iframeOrigin)` into its `contentWindow`, and forwards the
// `load` event (baked branch kicks the handshake on load).
//
// Sandbox SSOT (AREA §5 hardening over legacy's *no sandbox at all*): we set the standardized
// `allow-scripts allow-same-origin` sandbox — `allow-same-origin` is REQUIRED so the child runs its
// own Supabase calls under the injected JWT (the real auth boundary); the origin-pinned ACK check is
// defense-in-depth. Structural layout only (no custom CSS).

export function ChildAppIframe({ src, title, onRegister, onLoad }: ChildAppIframeProps) {
  const ref = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    onRegister(ref.current)
    return () => onRegister(null)
  }, [onRegister])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      onLoad={onLoad}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      className="h-full w-full border-0"
      data-testid="child-app-iframe"
    />
  )
}
