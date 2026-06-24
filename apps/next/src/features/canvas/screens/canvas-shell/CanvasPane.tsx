import { useEffect, useState } from 'react'
import { CanvasTabStrip } from '../../components/canvas-shell/CanvasTabStrip'
import { KernelPreviewPane } from '../KernelPreviewPane'
import { FileReaderScreen } from '../file-reader/FileReaderScreen'
import { DiffScreen } from '../diff/DiffScreen'
import { GraphScreen } from '../graph/GraphScreen'
import { HistoryScreen } from '../history/HistoryScreen'
import { ChildAppMountScreen } from '../child-app-mount/ChildAppMountScreen'
import { useCanvasStrings } from '../../i18n'
import type { CanvasPaneProps, CanvasTab, CanvasView } from '../../types'

// The canvas Stage pane — the shell Stage hosts THIS where it used to host the mock PreviewPane.
// Composition only (ARCHITECTURE §3): the tab strip (chrome) + the active view, routed by
// `canvasView` (the `view-switching-and-tabs` flow). Geometry (open/close, tiling↔overlay, resize)
// stays the Stage's. Each view is its own screen; data-backed views render honest empty states until
// the host hands them a session/project/run (cross-feature plumbing, tracked separately).

export function CanvasPane({
  onClose,
  onExpand,
  expanded,
  sessionId,
  hostWorkspaceId,
  surfaceKey,
  nodeName,
  projectId,
  chatId,
  codeAuthority,
  appSlug,
  openFile,
  openPage,
  onClosePage,
}: CanvasPaneProps) {
  const t = useCanvasStrings()
  const [view, setView] = useState<CanvasView>('preview')
  const [diffRunId, setDiffRunId] = useState<string | null>(null)

  // Auto-switch to the page tab whenever a page is opened (e.g. marketplace from the rail).
  const openPageId = openPage?.id ?? null
  useEffect(() => {
    if (openPageId) setView('page')
  }, [openPageId])

  // An embedded L1 tool (Agent Studio) fully replaces the canvas content — no view tabs.
  if (appSlug) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <CanvasTabStrip
          tabs={[{ id: 'child', kind: 'child', label: nodeName || t.tabs.preview }]}
          activeTabId="child"
          onSelectTab={() => {}}
          onExpand={onExpand}
          expanded={expanded}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1">
          <ChildAppMountScreen appSlug={appSlug} />
        </div>
      </div>
    )
  }

  const tabs: CanvasTab[] = [{ id: 'preview', kind: 'preview', label: nodeName || t.tabs.preview }]
  if (openFile) tabs.push({ id: 'file', kind: 'file', label: openFile.name, closable: true })
  if (openPage) tabs.push({ id: 'page', kind: 'page', label: openPage.label, closable: true })
  // Diff / Graph / History tabs are hidden from the strip for now (owner directive). The views and
  // their routing below remain wired so they can be re-surfaced without rebuilding.

  // Guard: if the active view's content was removed (e.g. page closed externally), fall back to preview.
  const activeTabId = tabs.some((t) => t.id === view) ? view : 'preview'

  // `previewIdentityKey` (host workspace + surface + session) remounts the preview subtree so a prior
  // app/session never leaks into the next selection (AGI-60/61) — React's idiomatic "key to reset".
  const identityKey = `${hostWorkspaceId ?? ''}::${surfaceKey ?? ''}::${sessionId ?? ''}`

  // Which overlay view (if any) is active. Mirrors the old ternary precedence exactly so behaviour is
  // unchanged. When none is active, the always-mounted preview underneath is visible.
  const showPage = activeTabId === 'page' && !!openPage
  const showFile = !showPage && activeTabId === 'file' && !!openFile
  const showDiff = !showPage && !showFile && view === 'diff'
  const showGraph = !showPage && !showFile && !showDiff && view === 'graph'
  const showHistory = !showPage && !showFile && !showDiff && !showGraph && view === 'history'
  const isPreviewActive = !showPage && !showFile && !showDiff && !showGraph && !showHistory

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(id) => setView(id as CanvasView)}
        onCloseTab={(id) => {
          if (id === 'file') setView('preview')
          if (id === 'page') { setView('preview'); onClosePage?.() }
        }}
        onExpand={onExpand}
        expanded={expanded}
        onClose={onClose}
      />
      <div className="relative min-h-0 flex-1">
        {/* Preview stays MOUNTED across tab switches so its <iframe> never reloads — switching to
            Marketplace/file/etc. and back preserves the running app's state. It's hidden with CSS
            (display:none), not unmounted, when another view is active. */}
        <div className={`absolute inset-0${isPreviewActive ? '' : ' hidden'}`}>
          {/* Kernel preview: the iframe URL comes from the `preview_ready` bus (core/kernel), surfaced
              when a run exposes a port. The legacy runner-snapshot PreviewScreen never resolves on the
              stateless kernel (it hangs at "Creating your workspace…"), so it is not used here. */}
          <KernelPreviewPane key={identityKey} sessionId={sessionId} />
        </div>
        {/* Overlay views render on top of the hidden preview while active. These are data-backed and
            cheap to remount, so they unmount when inactive (only the preview needs state preservation). */}
        {showPage ? (
          <div className="absolute inset-0 overflow-auto">{openPage!.content}</div>
        ) : showFile ? (
          <div className="absolute inset-0">
            <FileReaderScreen
              key={openFile!.path}
              path={openFile!.path}
              name={openFile!.name}
              rootId={openFile!.rootId}
              sessionId={sessionId}
              projectId={projectId}
              codeAuthority={codeAuthority ?? undefined}
            />
          </div>
        ) : showDiff ? (
          <div className="absolute inset-0">
            <DiffScreen runId={diffRunId} />
          </div>
        ) : showGraph ? (
          <div className="absolute inset-0">
            <GraphScreen
              projectId={projectId}
              sessionId={sessionId}
              codeAuthority={codeAuthority}
              onOpenFile={() => setView('file')}
            />
          </div>
        ) : showHistory ? (
          <div className="absolute inset-0">
            <HistoryScreen
              projectId={projectId}
              chatId={chatId}
              onViewDiff={(runId) => {
                setDiffRunId(runId)
                setView('diff')
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
