// Public surface of the `canvas` feature module (ARCHITECTURE §5 rule 1: other layers import THIS,
// nothing deeper). The canvas is the Builder's preview/canvas Stage pane — see docs/design/canvas/.
//
// BUILD STATUS: Phase 1 (foundation) — the access-layer seam (`@/core/preview`), the simplified
// state machine + URL/stage logic (`lib/**`), types, and i18n. The screen views (`<CanvasPane>` etc.)
// + the `usePreview` lifecycle hook land in Phase 2 and are added to this surface as they build.

export { useCanvasStrings, canvasStrings, type CanvasStrings } from './i18n'
export type {
  Viewport,
  LaunchDiagnostic,
  CanvasPaneProps,
  DegradedStatePanelProps,
  PreviewPaneState,
  PreviewState,
  PreviewStage,
  PreviewSnapshotData,
} from './types'
export { VIEWPORT_WIDTH } from './types'
export { mapSnapshotToState, isNewerSnapshot, isDegraded } from './lib/previewState'
export { deriveStage } from './lib/deriveStage'
export { buildPreviewUrl, cachedViewerPreflightUrl } from './lib/previewUrl'
export { usePreview, type UsePreviewOptions, type UsePreviewResult } from './hooks/usePreview'
export { CanvasPane } from './screens/canvas-shell/CanvasPane'
export { PreviewScreen } from './screens/preview/PreviewScreen'
export { KernelPreviewPane } from './screens/KernelPreviewPane'
export { FileReaderScreen } from './screens/file-reader/FileReaderScreen'
export { DiffScreen } from './screens/diff/DiffScreen'
export { GraphScreen } from './screens/graph/GraphScreen'
export { HistoryScreen } from './screens/history/HistoryScreen'
export { ChildAppMountScreen } from './screens/child-app-mount/ChildAppMountScreen'
export type { CanvasTab, CanvasView } from './types'
