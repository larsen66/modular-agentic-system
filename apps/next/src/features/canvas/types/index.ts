import type { ReactNode } from 'react'
import type { PreviewState } from '../lib/previewState'
import type { PreviewStage } from '../lib/deriveStage'

// Single types surface for the canvas feature module (ARCHITECTURE §3): domain types + component
// prop contracts. Seam/contract types (the runner preview snapshot) are DEFINED in the access layer
// (`@/core/preview`) — a lower layer than features — so they are re-exported here, not redefined.

export type { PreviewSnapshotData, PreviewSurface, PreviewStatus, PreviewErrorCode } from '@/core/preview'
export type { PreviewState } from '../lib/previewState'
export type { PreviewStage } from '../lib/deriveStage'

// ── Domain ──

/** Viewport device frame (canvas `preview` screen header). */
export type Viewport = 'desktop' | 'tablet' | 'mobile'

/** Pixel width per viewport (`desktop` = full width). */
export const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

/** The launch-diagnostic the provisioning overlay shows (derived from the snapshot progress). */
export interface LaunchDiagnostic {
  stage: PreviewStage
  message: string | null
  current: number | null
  total: number | null
}

// ── Component props ──


/** Degraded/empty state panel (shared widget) — one surface for every non-ready preview state. */
export interface DegradedStatePanelProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Primary recovery action (e.g. Retry / Restart / Start new chat). */
  actionLabel?: string
  onAction?: () => void
  /** Emphasis of the panel (maps to a HeroUI semantic tone, not a custom color). */
  tone?: 'muted' | 'warning' | 'danger'
}

/** State-to-presentation hint the canvas pane resolves from `PreviewState`. */
export type PreviewPaneState = PreviewState | 'no_session'

// ── Tab model (our capability — one app/node tab + N file tabs; rendered as buttons, not Tabs) ──

export type CanvasTabKind = 'preview' | 'file' | 'diff' | 'graph' | 'history' | 'child' | 'page'

/** The canvas view a tab routes to (canvas-shell `view-switching-and-tabs`). */
export type CanvasView = CanvasTabKind

export interface CanvasTab {
  id: string
  kind: CanvasTabKind
  label: string
  /** File tabs are closable; the app/preview tab is not. */
  closable?: boolean
}

/** Top row — tab BUTTONS + `+` menu + expand/panel-toggle (Codex look, our capabilities). */
export interface CanvasTabStripProps {
  tabs: CanvasTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab?: (id: string) => void
  /** `+` menu — open a file (and, as views land, graph/history/diff). */
  onOpenFile?: () => void
  /** Bring the preview to front / maximize (Stage-owned focus). */
  onExpand?: () => void
  /** Whether the pane is currently in full-expand mode — swaps the expand icon to compress. */
  expanded?: boolean
  /** Hide the canvas pane (panel toggle). */
  onClose: () => void
  /** Drop the strip's bottom hairline — the preview view sits flush under the tabs (no seam). */
  flush?: boolean
}

/** The browser-chrome toolbar row — reload + address + `⋮` actions (our reload/viewport/share/external). */
export interface PreviewToolbarProps {
  /** Current preview URL (read-only address display); null → empty "Enter a URL" affordance. */
  url: string | null
  onReload: () => void
  onOpenExternal: () => void
  onShare?: () => void
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  /** Disable URL-dependent actions when there's no live preview. */
  disabled?: boolean
}

/** The preview screen — toolbar + state-driven content. */
export interface PreviewScreenProps {
  sessionId?: string | null
  hostWorkspaceId?: string | null
  surfaceKey?: string | null
  onShare?: () => void
}

/** The canvas Stage pane — tab strip + active view (composition; replaces the mock PreviewPane). */
export interface CanvasPaneProps {
  onClose: () => void
  onExpand?: () => void
  expanded?: boolean
  sessionId?: string | null
  hostWorkspaceId?: string | null
  surfaceKey?: string | null
  nodeName?: string
  onShare?: () => void
  /** Scope for the data-backed views (history/graph/file-reader). */
  projectId?: string | null
  chatId?: string | null
  /** Edit/visual-edit authority from surfaceConfig; gates file edit + graph open-file. */
  codeAuthority?: 'none' | 'read' | 'write' | string | null
  /** When set, an embedded L1 tool (Agent Studio) is mounted instead of the preview. */
  appSlug?: string
  /** When set, a file-reader tab is open for this workspace file. */
  openFile?: { path: string; name: string; rootId?: string }
  /** When set, a page tab is open (e.g. marketplace). Content is rendered inside the canvas. */
  openPage?: { id: string; label: string; content: ReactNode }
  /** Called when the user closes the page tab — lets the host reset its page-open state. */
  onClosePage?: () => void
}

// ── Per-screen type surfaces (graduated types/ folder — one file per screen, owned by that screen) ──
export type * from './file-reader'
export type * from './diff'
export type * from './graph'
export type * from './history'
export type * from './child-app-mount'
