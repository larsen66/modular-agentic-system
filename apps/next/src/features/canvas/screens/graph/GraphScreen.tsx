import { useMemo, useState } from 'react'
import { Alert, Button, Skeleton, Spinner } from '@heroui/react'
import { AlertTriangle, GitFork, Network } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { useAppGraph } from './useAppGraph'
import { useCanvasStrings } from '../../i18n'
import { GraphCanvas } from '../../components/graph/GraphCanvas'
import { GraphToolbar } from '../../components/graph/GraphToolbar'
import { GraphLegend } from '../../components/graph/GraphLegend'
import { GraphNodeDetail } from '../../components/graph/GraphNodeDetail'
import type { GraphScreenProps, GraphLayout } from '../../types/graph'
import type { GraphNode, GraphNodeKind } from '@/core/appGraph'

// The graph screen (canvas `graph` view) — composition only (ARCHITECTURE §3): wires `useAppGraph` +
// GraphCanvas + toolbar/legend/detail into the view-router layout. State-driven, honest: loading →
// Skeleton+Spinner; empty / no_session → DegradedStatePanel; error → Alert+Retry; populated →
// diagram + toolbar + legend. NO custom CSS; the renderer is dependency-free behind GraphCanvas (the
// real React Flow renderer drops in there — phase-2 dep, see core/appGraph.ts).

const ALL_KINDS: GraphNodeKind[] = ['app', 'folder', 'chat', 'mounted-app']

export function GraphScreen({ projectId, sessionId, codeAuthority, onOpenFile }: GraphScreenProps) {
  const t = useCanvasStrings()
  const { state, graph, error, refresh } = useAppGraph(projectId, sessionId)

  const [layout, setLayout] = useState<GraphLayout>('hierarchical')
  const [visibleKinds, setVisibleKinds] = useState<GraphNodeKind[]>(ALL_KINDS)
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [fitSignal, setFitSignal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedNode = useMemo<GraphNode | null>(
    () => graph?.nodes.find((n) => n.id === selectedId) ?? null,
    [graph, selectedId],
  )
  const { inDegree, outDegree } = useMemo(() => {
    if (!graph || !selectedId) return { inDegree: 0, outDegree: 0 }
    return {
      inDegree: graph.edges.filter((e) => e.target === selectedId).length,
      outDegree: graph.edges.filter((e) => e.source === selectedId).length,
    }
  }, [graph, selectedId])

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<GraphNodeKind, number>> = {}
    for (const n of graph?.nodes ?? []) counts[n.kind] = (counts[n.kind] ?? 0) + 1
    return counts
  }, [graph])

  const canOpenFile = (codeAuthority ?? 'none') !== 'none'

  // ── States (honest; never a fabricated graph) ──
  if (state === 'no_session') {
    return (
      <DegradedStatePanel
        icon={<Network className="size-8" />}
        title={t.graph.states.noSession.title}
        description={t.graph.states.noSession.description}
      />
    )
  }
  if (state === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
        <Spinner size="lg" />
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
        </div>
        <p className="text-sm text-muted">{t.graph.states.loading}</p>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
        <Alert status="danger" className="max-w-md">
          <Alert.Indicator><AlertTriangle className="size-4" /></Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{t.graph.states.error.title}</Alert.Title>
            <Alert.Description>{error ?? t.graph.states.error.description}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={refresh}>{t.graph.states.error.action}</Button>
        </Alert>
      </div>
    )
  }
  if (state === 'empty' || !graph) {
    return (
      <DegradedStatePanel
        icon={<GitFork className="size-8" />}
        title={t.graph.states.empty.title}
        description={t.graph.states.empty.description}
        actionLabel={t.graph.states.empty.action}
        onAction={refresh}
      />
    )
  }

  // ── Populated ──
  return (
    <div className="flex h-full min-h-0 flex-col bg-overlay">
      <GraphToolbar
        layout={layout}
        onLayoutChange={setLayout}
        visibleKinds={visibleKinds}
        onToggleKind={setVisibleKinds}
        query={query}
        onQueryChange={setQuery}
        onFit={() => setFitSignal((n) => n + 1)}
        zoom={zoom}
        onZoomChange={setZoom}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
      />
      <div className="relative min-h-0 flex-1 bg-background">
        <GraphCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          layout={layout}
          visibleKinds={visibleKinds}
          query={query}
          selectedNodeId={selectedId}
          onSelect={setSelectedId}
          fitSignal={fitSignal}
          zoom={zoom}
          onZoomChange={setZoom}
        />
        <div className="pointer-events-none absolute bottom-3 left-3">
          <div className="pointer-events-auto">
            <GraphLegend source={graph.source} kindCounts={kindCounts} />
          </div>
        </div>
      </div>
      <GraphNodeDetail
        node={selectedNode}
        inDegree={inDegree}
        outDegree={outDegree}
        canOpenFile={canOpenFile}
        onOpenFile={(n) => onOpenFile?.(n)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
