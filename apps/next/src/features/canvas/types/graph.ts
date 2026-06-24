import type { AppGraph, GraphNode, GraphEdge, GraphNodeKind, GraphEdgeKind, GraphSource } from '@/core/appGraph'

// Graph-screen type surface (canvas feature module). The DOMAIN graph types are DEFINED in the
// access layer (`@/core/appGraph`) — a lower layer than features — so they are re-exported here, not
// redefined (same discipline as the preview snapshot in types/index.ts). This file adds only the
// graph-screen UI/view types (selection, layout, component props).

export type { AppGraph, GraphNode, GraphEdge, GraphNodeKind, GraphEdgeKind, GraphSource }

// ── View state ──

/** Renderer layout algorithms the toolbar's Layout picker offers (v1 uses the structural layout). */
export type GraphLayout = 'hierarchical' | 'force' | 'radial'

/** The non-fabricated view states (mirrors the preview honesty model). */
export type GraphViewState = 'loading' | 'empty' | 'error' | 'no_session' | 'populated'

// ── Component props ──

/** The graph screen — toolbar + state-driven diagram + detail. Composition only. */
export interface GraphScreenProps {
  /** Project whose structure to map; null → no_session/empty handling. */
  projectId?: string | null
  /** Runner session (PHASE-2 module-graph path); v1 builds the containment graph without it. */
  sessionId?: string | null
  /** From surfaceConfig: `'none'` (demo/visitor) disables the "Open file" hand-off (graph still views). */
  codeAuthority?: 'none' | 'read' | 'write' | string | null
  /** Hand-off to the file-reader view when a node with a path is opened (`view-switching-and-tabs`). */
  onOpenFile?: (node: GraphNode) => void
}

/** The 3rd-party renderer ADAPTER boundary — the ONE swap point (React Flow drops in behind this). */
export interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  layout: GraphLayout
  /** Kinds currently shown (filter); a node hidden if its kind is absent. */
  visibleKinds: GraphNodeKind[]
  /** Free-text node search; non-matching nodes are de-emphasized (not removed). */
  query: string
  selectedNodeId: string | null
  onSelect: (nodeId: string | null) => void
  /** Imperative viewport calls the toolbar drives (the adapter wires these to the renderer API). */
  fitSignal: number
  zoom: number
  onZoomChange: (zoom: number) => void
}

/** Toolbar row — layout / filter / search / fit / zoom + node-edge counts. */
export interface GraphToolbarProps {
  layout: GraphLayout
  onLayoutChange: (l: GraphLayout) => void
  visibleKinds: GraphNodeKind[]
  onToggleKind: (kinds: GraphNodeKind[]) => void
  query: string
  onQueryChange: (q: string) => void
  onFit: () => void
  zoom: number
  onZoomChange: (z: number) => void
  nodeCount: number
  edgeCount: number
  /** True when the graph data predates the last run (shows a "stale" chip). */
  stale?: boolean
  disabled?: boolean
}

/** Bottom-left legend overlay — one row per node/edge kind present. */
export interface GraphLegendProps {
  /** Edge-semantics provenance ("contains" vs "imports") — drives non-overclaiming copy. */
  source: GraphSource
  /** Per-kind counts to show next to each legend row. */
  kindCounts: Partial<Record<GraphNodeKind, number>>
}

/** Node-detail drawer — opens on selection; "Open file" gated by codeAuthority. */
export interface GraphNodeDetailProps {
  node: GraphNode | null
  /** In/out edge counts for the selected node (fan-in / fan-out). */
  inDegree: number
  outDegree: number
  /** `false` when codeAuthority==='none' (demo/visitor) — disables "Open file". */
  canOpenFile: boolean
  onOpenFile: (node: GraphNode) => void
  onClose: () => void
}

/** The HeroUI Card/Chip node body rendered INSIDE the renderer (the one non-HeroUI structural seam). */
export interface GraphNodeBodyProps {
  node: GraphNode
  selected: boolean
  /** De-emphasized when a search query is active and this node doesn't match. */
  dimmed?: boolean
  onPress: (nodeId: string) => void
}
