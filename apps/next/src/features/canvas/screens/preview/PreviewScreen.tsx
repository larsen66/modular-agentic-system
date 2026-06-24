import { useEffect, useState } from 'react'
import { Chip, Spinner } from '@heroui/react'
import { AlertTriangle, Globe, PowerOff, RouteOff } from 'lucide-react'
import { DeviceFrame } from '@/shared/DeviceFrame'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { PreviewIframeHost } from '@/shared/PreviewIframeHost'
import { getKernelPreview, onKernelPreview } from '@/core/kernel'
import { useUiStore } from '@/state/uiStore'
import { usePreview } from '../../hooks/usePreview'
import { useCanvasStrings } from '../../i18n'
import { PreviewToolbar } from '../../components/preview/PreviewToolbar'
import { VIEWPORT_WIDTH, type PreviewScreenProps, type Viewport } from '../../types'

// The preview screen — the live app preview view. Toolbar (chrome row) + state-driven content from
// `usePreview` (the simplified lifecycle machine). Visual shell follows the owner's design reference;
// behavior is OUR preview-lifecycle (provisioning → ready handoff → degraded recovery). No custom CSS.

export function PreviewScreen({ sessionId, hostWorkspaceId, surfaceKey, onShare }: PreviewScreenProps) {
  const t = useCanvasStrings()
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [handingOff, setHandingOff] = useState(false)

  const preview = usePreview(sessionId ?? null, { hostWorkspaceId, surfaceKey })
  const { state, previewUrl: runnerUrl, diagnostic, reload, retry, restart, registerIframe } = preview

  // Kernel preview bus: the custom TS kernel emits `preview_ready { url }` inline on the run stream
  // (no runner-style snapshot lifecycle), stashed in core/kernel. When present it IS the live preview,
  // so it wins over the runner snapshot machine — which never settles on the kernel path and would
  // otherwise hang this screen at "Creating your workspace…".
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen)
  const [kernelUrl, setKernelUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!sessionId) {
      setKernelUrl(null)
      return
    }
    setKernelUrl(getKernelPreview(sessionId) ?? null)
    return onKernelPreview((sid, url) => {
      if (sid !== sessionId) return
      setKernelUrl(url)
      // Surface the sandbox immediately — pop the preview pane open the moment a URL lands.
      setPreviewOpen(true)
    })
  }, [sessionId, setPreviewOpen])

  // Kernel URL wins; fall back to the runner snapshot URL. `ready` is forced by a kernel URL.
  const previewUrl = kernelUrl ?? runnerUrl
  const isReady = Boolean(kernelUrl) || state === 'ready'

  const openExternal = () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    // Toolbar is absolutely overlaid at the top — it does not participate in the canvas flex column
    // so the content area height never shifts when switching between canvas tabs.
    <div className="relative h-full min-h-0 bg-overlay">
      <div className="absolute inset-x-0 top-0 z-10">
        <PreviewToolbar
          url={previewUrl}
          onReload={reload}
          onOpenExternal={openExternal}
          onShare={onShare}
          viewport={viewport}
          onViewportChange={setViewport}
          disabled={!isReady}
        />
      </div>

      <div className="absolute inset-0 top-10 bg-background">
        {isReady && previewUrl ? (
          <>
            <DeviceFrame width={VIEWPORT_WIDTH[viewport]}>
              <PreviewIframeHost
                url={previewUrl}
                hostWorkspaceId={hostWorkspaceId}
                surfaceKey={surfaceKey}
                title={t.tabs.preview}
                onRegisterIframe={registerIframe}
                onHandoffChange={setHandingOff}
                onRouterUpgrade={preview.markRouterUpgrade}
              />
            </DeviceFrame>
            {handingOff ? (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
                <Chip size="sm" variant="soft">{t.handoff}</Chip>
              </div>
            ) : null}
          </>
        ) : state === 'provisioning' ? (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <Spinner size="lg" />
              <p className="text-sm text-muted">{t.stage[diagnostic.stage] ?? t.stage.creating}</p>
              {diagnostic.message ? <p className="text-xs text-muted">{diagnostic.message}</p> : null}
            </div>
          </div>
        ) : state === 'evicted' ? (
          <DegradedStatePanel
            icon={<PowerOff className="size-8" />}
            tone="warning"
            title={t.states.evicted.title}
            description={t.states.evicted.description}
            actionLabel={t.states.evicted.action}
            onAction={restart}
          />
        ) : state === 'router_upgrade' ? (
          <DegradedStatePanel
            icon={<RouteOff className="size-8" />}
            tone="warning"
            title={t.states.routerUpgrade.title}
            description={t.states.routerUpgrade.description}
          />
        ) : state === 'container_dead' ? (
          <DegradedStatePanel
            icon={<PowerOff className="size-8" />}
            tone="danger"
            title={t.states.containerDead.title}
            description={t.states.containerDead.description}
            actionLabel={t.states.containerDead.action}
            onAction={restart}
          />
        ) : state === 'error' ? (
          <DegradedStatePanel
            icon={<AlertTriangle className="size-8" />}
            tone="danger"
            title={t.states.error.title}
            description={t.states.error.description}
            actionLabel={t.states.error.action}
            onAction={retry}
            secondaryActionLabel={t.states.error.restart}
            onSecondaryAction={restart}
          />
        ) : (
          <DegradedStatePanel
            icon={<Globe className="size-8" />}
            title={t.states.noSession.title}
            description={t.states.noSession.description}
          />
        )}
      </div>
    </div>
  )
}
