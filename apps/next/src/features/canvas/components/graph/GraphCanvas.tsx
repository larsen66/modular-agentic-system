import { useMemo } from 'react'
import { GraphNodeBody } from './GraphNodeBody'
import type { GraphCanvasProps } from '../../types/graph'

// GraphCanvas — the thin 3rd-party-renderer ADAPTER boundary (design §3, Variant A). React Flow
// (`@xyflow/react`) is the recommended renderer but is NOT installed and we add no deps in v1, so
// this ships a DEPENDENCY-FREE structural layout: a hierarchical containment view (root → children
// columns) of HeroUI Card node bodies. A real 2D pan/zoom/fit renderer drops in behind THIS file
// without touching the screen/toolbar/legend/detail — flagged phase-2 dep: @xyflow/react + dagre/ELK.
//
// HONESTY: renders nothing fabricated — it only lays out the nodes/edges it is handed. Empty arrays
// are handled by the SCREEN (empty state), so this assumes ≥1 node when mounted.

export function GraphCanvas({
  nodes,
  edges,
  visibleKinds,
  query,
  selectedNodeId,
  onSelect,
}: GraphCanvasProps) {
  // Containment layout: root row, then children grouped by their parent edge. v1 ignores `layout`
  // (the structural renderer is hierarchical); the real renderer will honor it. Memoized on inputs.
  const { root, children, hidden } = useMemo(() => {
    const visible = new Set(visibleKinds)
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const rootNode = nodes.find((n) => n.isRoot) ?? nodes[0]
    const childIds = edges
      .filter((e) => e.source === rootNode?.id)
      .map((e) => e.target)
      .filter((id) => byId.has(id))
    const childNodes = childIds.map((id) => byId.get(id)!).filter((n) => visible.has(n.kind))
    const hiddenCount = nodes.length - childNodes.length - (rootNode && visible.has(rootNode.kind) ? 1 : 0)
    return { root: rootNode, children: childNodes, hidden: Math.max(0, hiddenCount) }
  }, [nodes, edges, visibleKinds])

  const q = query.trim().toLowerCase()
  const matches = (label: string) => !q || label.toLowerCase().includes(q)

  if (!root) return null

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col items-center gap-6 overflow-auto p-8"
      role="group"
      aria-label="App structure graph"
      data-testid="graph-canvas"
    >
      {/* Root (the app) */}
      <div className="w-64 max-w-full">
        <GraphNodeBody
          node={root}
          selected={selectedNodeId === root.id}
          dimmed={!matches(root.label)}
          onPress={onSelect}
        />
      </div>

      {/* Connector hint (structural — real renderer draws edges) */}
      {children.length > 0 ? <div className="h-px w-12 bg-border" aria-hidden /> : null}

      {/* Children row (chats + mounted apps), wrapping */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {children.map((n) => (
          <div key={n.id} className="w-56 max-w-full">
            <GraphNodeBody
              node={n}
              selected={selectedNodeId === n.id}
              dimmed={!matches(n.label)}
              onPress={onSelect}
            />
          </div>
        ))}
      </div>

      {hidden > 0 ? (
        <p className="text-xs text-muted">{hidden} node{hidden === 1 ? '' : 's'} hidden by filter</p>
      ) : null}
    </div>
  )
}
