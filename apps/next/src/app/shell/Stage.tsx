import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Button, Tooltip } from '@heroui/react'
import { PanelRight } from 'lucide-react'
import {
  CHAT_MIN_WIDTH,
  clampPreviewWidth,
  PREVIEW_EDGE_GUTTER,
  PREVIEW_MIN_WIDTH,
  useUiStore,
} from '@/state/uiStore'
import { ChatPane, ChatTabBar, PreviewChatOverlay, RouteSelectionSync } from '@/features/chat'
import { CanvasPane } from '@/features/canvas'
import { SettingsPage } from '@/features/shell/screens/settings'
import { MarketplacePage } from '@/features/shell/screens/marketplace/MarketplacePage'
import { SURFACE_KEY_QS, WORKSPACE_QS } from '@/lib/route'
import { PreviewResizer } from './preview/PreviewResizer'

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

const PREVIEW_CARD_INSET = 4

export function Stage() {
  const activeMode = useUiStore((s) => s.activeMode)
  const canvasPage = useUiStore((s) => s.canvasPage)
  const setCanvasPage = useUiStore((s) => s.setCanvasPage)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen)
  const togglePreview = useUiStore((s) => s.togglePreview)
  const previewWidth = useUiStore((s) => s.previewWidth)
  const setPreviewWidth = useUiStore((s) => s.setPreviewWidth)
  // Session context — written by useChat (inside ChatPane) when a session resolves; read here
  // to pass to CanvasPane so the preview subscribes to the correct runner session.
  const activeSessionId = useUiStore((s) => s.activeSessionId)
  const params = useParams()
  const [sp] = useSearchParams()
  const projectId = params.projectId ?? null
  const chatId = params.chatId ?? null
  const hostWorkspaceId = sp.get(WORKSPACE_QS) ?? null
  const surfaceKey = sp.get(SURFACE_KEY_QS) ?? null


  const [resizing, setResizing] = useState(false)
  const [previewFull, setPreviewFull] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  // Suppress width transition when toggling full-expand. useLayoutEffect fires before paint so
  // expanding=true is already in the DOM before the first frame — the change is truly instant.
  // useEffect fires after paint, which lets one animated frame slip through before disabling.
  useLayoutEffect(() => {
    setExpanding(true)
    const id = requestAnimationFrame(() => setExpanding(false))
    return () => cancelAnimationFrame(id)
  }, [previewFull])

  const [settledClosed, setSettledClosed] = useState(!previewOpen)
  useEffect(() => {
    if (previewOpen) {
      const id = requestAnimationFrame(() => setSettledClosed(false))
      return () => cancelAnimationFrame(id)
    }
    const id = window.setTimeout(() => setSettledClosed(true), 320)
    return () => window.clearTimeout(id)
  }, [previewOpen])
  const showToggle = !previewOpen && settledClosed

  const roRef = useRef<ResizeObserver | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // Measure via contentRef — same width as Stage since both span full available width.
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    roRef.current = new ResizeObserver(measure)
    roRef.current.observe(el)
  }, [])

  const previewMax = Math.max(PREVIEW_MIN_WIDTH, containerWidth - PREVIEW_EDGE_GUTTER)
  const previewW = previewFull ? containerWidth : clampPreviewWidth(previewWidth, containerWidth)
  const chatW = previewOpen ? Math.max(CHAT_MIN_WIDTH, containerWidth - previewW) : containerWidth
  const animate = ready && !resizing && !expanding

  // Canvas pages (e.g. marketplace) open as tabs inside the canvas pane.
  // canvasPage carries id+label; Stage composes the ReactNode content by id.
  const openPage = useMemo(() => {
    if (!canvasPage) return undefined
    if (canvasPage.id === 'marketplace') {
      return { id: 'marketplace', label: canvasPage.label, content: <MarketplacePage /> }
    }
    return undefined
  }, [canvasPage])

  if (activeMode === 'settings') {
    return <div className="flex h-full min-h-0 flex-1 flex-col"><SettingsPage /></div>
  }

  return (
    // `relative` so the preview pane can be absolute here and cover the full Stage height
    // including the tab strip — it is NOT inside contentRef.
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <RouteSelectionSync />

      <div className="flex shrink-0 items-center bg-background">
        <ChatTabBar />
        {showToggle && (
          <div className="flex shrink-0 items-center gap-1 pr-2">
            <Tooltip delay={300}>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Open preview" onPress={togglePreview} className="rounded">
                <PanelRight className="size-4" />
              </Button>
              <Tooltip.Content placement="bottom">Open preview</Tooltip.Content>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Chat pane only — overflow:hidden here only clips the chat, not the preview. */}
      <div ref={contentRef} className="relative z-20 min-h-0 flex-1 overflow-hidden bg-background">
        <div
          style={{ width: chatW }}
          className={cx(
            'absolute inset-y-0 left-0 z-10 bg-background',
            animate ? 'transition-[width] duration-300 ease-out' : 'transition-none',
          )}
        >
          <div className="relative h-full">
            <ChatPane />
          </div>
        </div>
      </div>

      {/* Preview pane — absolute within Stage (not contentRef) so it overlays everything
          including the tab strip. z-30 beats both the chat pane (z-10/20) and the tab strip
          (normal flow, no z-index). Transparent margin: the top gap shows tab-strip
          bg-background which matches the card — no dark strip. */}
      <div
        style={{ width: previewW }}
        className={cx(
          'absolute inset-y-0 right-0 z-30',
          !previewOpen ? 'translate-x-full pointer-events-none' : 'translate-x-0',
          animate ? 'transition-[width,translate,transform] duration-300 ease-out' : 'transition-none',
        )}
      >
        <div className="flex h-full">
          <div
            className="relative flex-1 overflow-hidden rounded-surface border bg-background"
            style={{ margin: PREVIEW_CARD_INSET }}
          >
            <CanvasPane
              onClose={() => { setPreviewOpen(false); setPreviewFull(false) }}
              onExpand={() => setPreviewFull((f) => !f)}
              expanded={previewFull}
              sessionId={activeSessionId}
              hostWorkspaceId={hostWorkspaceId}
              surfaceKey={surfaceKey}
              projectId={projectId}
              chatId={chatId}
              openPage={openPage}
              onClosePage={() => setCanvasPage(null)}
            />
            {previewFull && <PreviewChatOverlay />}
          </div>
        </div>
      </div>

      {previewOpen && (
        <PreviewResizer
          width={previewW}
          cardInset={PREVIEW_CARD_INSET}
          min={PREVIEW_MIN_WIDTH}
          max={previewMax}
          onResize={setPreviewWidth}
          onGrab={() => { setResizing(true); setPreviewFull(false) }}
          onRelease={() => setResizing(false)}
        />
      )}
    </div>
  )
}
