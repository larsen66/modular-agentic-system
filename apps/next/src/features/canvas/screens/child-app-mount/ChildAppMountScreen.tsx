import { Spinner } from '@heroui/react'
import { AlertTriangle, KeyRound, PackageX } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { useChildAppMount } from '../../hooks/useChildAppMount'
import { useCanvasStrings } from '../../i18n'
import { ChildAppIframe } from '../../components/child-app-mount/ChildAppIframe'
import type { ChildAppMountScreenProps } from '../../types/child-app-mount'

// The `child-app-mount` screen — chrome ONLY (loading / error / ready iframe) for an embedded L1
// internal tool (Agent Studio). The mount resolution + AOS_INIT/AOS_INIT_ACK handshake + retry FSM
// are owned by `useChildAppMount` (the `child-app-handshake` flow); this is the view at rest:
//   - loading → centered Spinner + phase label (Variant A: shared resting-state look)
//   - error   → DegradedStatePanel (tone by failure class) + Reload (no retry for terminal config)
//   - ready   → the iframe alone, full-bleed
// HeroUI + semantic tokens + structural layout only (NO custom CSS).

export function ChildAppMountScreen({ appSlug, runtimeOverride }: ChildAppMountScreenProps) {
  const t = useCanvasStrings()
  const c = t.childMount
  const { view, iframeSrc, registerIframe, onIframeLoad, reload, busy } = useChildAppMount(appSlug, {
    runtimeOverride,
  })

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-background">
      {view.kind === 'ready' && iframeSrc ? (
        <ChildAppIframe
          src={iframeSrc}
          title={c.iframeTitle}
          onRegister={registerIframe}
          onLoad={onIframeLoad}
        />
      ) : view.kind === 'loading' ? (
        <>
          {/* Iframe stays mounted (hidden) through the handshake so its contentWindow is reachable. */}
          {iframeSrc ? (
            <div className="absolute h-0 w-0 overflow-hidden" aria-hidden>
              <ChildAppIframe
                src={iframeSrc}
                title={c.iframeTitle}
                onRegister={registerIframe}
                onLoad={onIframeLoad}
              />
            </div>
          ) : null}
          <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <Spinner size="lg" color="accent" />
              <p className="text-sm text-muted">{c.loading[view.phase]}</p>
            </div>
          </div>
        </>
      ) : view.kind === 'error' && view.reason === 'no-such-app' ? (
        <DegradedStatePanel
          icon={<PackageX className="size-8" />}
          tone="danger"
          title={c.errors.noSuchApp.title}
          description={c.errors.noSuchApp.description}
        />
      ) : view.kind === 'error' && view.reason === 'misconfigured' ? (
        <DegradedStatePanel
          icon={<AlertTriangle className="size-8" />}
          tone="danger"
          title={c.errors.misconfigured.title}
          description={c.errors.misconfigured.description}
        />
      ) : view.kind === 'error' && view.reason === 'no-session' ? (
        <DegradedStatePanel
          icon={<KeyRound className="size-8" />}
          tone="warning"
          title={c.errors.noSession.title}
          description={c.errors.noSession.description}
          actionLabel={c.errors.reload}
          onAction={reload}
          busy={busy}
        />
      ) : (
        <DegradedStatePanel
          icon={<AlertTriangle className="size-8" />}
          tone="danger"
          title={c.errors.failed.title}
          description={c.errors.failed.description}
          actionLabel={c.errors.reload}
          onAction={reload}
          busy={busy}
        />
      )}
    </div>
  )
}
