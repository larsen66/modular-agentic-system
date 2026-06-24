import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GraphCanvas } from '@/features/canvas/components/graph/GraphCanvas'
import type { GraphNode, GraphEdge, GraphNodeKind } from '@/core/appGraph'

const nodes: GraphNode[] = [
  { id: 'p1', label: 'Root App', kind: 'app', path: null, icon: null, isRoot: true },
  { id: 'c1', label: 'Alpha chat', kind: 'chat', path: null, icon: null },
  { id: 'm1', label: 'CRM mount', kind: 'mounted-app', path: null, icon: null },
]
const edges: GraphEdge[] = [
  { id: 'e1', source: 'p1', target: 'c1', kind: 'contains' },
  { id: 'e2', source: 'p1', target: 'm1', kind: 'mount' },
]

function renderCanvas(over: Partial<React.ComponentProps<typeof GraphCanvas>> = {}) {
  const onSelect = vi.fn()
  render(
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      layout="hierarchical"
      visibleKinds={['app', 'chat', 'mounted-app'] as GraphNodeKind[]}
      query=""
      selectedNodeId={null}
      onSelect={onSelect}
      fitSignal={0}
      zoom={1}
      onZoomChange={vi.fn()}
      {...over}
    />,
  )
  return onSelect
}

describe('GraphCanvas adapter', () => {
  it('renders root + child node bodies from the fixture', () => {
    renderCanvas()
    expect(screen.getByText('Root App')).toBeTruthy()
    expect(screen.getByText('Alpha chat')).toBeTruthy()
    expect(screen.getByText('CRM mount')).toBeTruthy()
  })

  it('clicking a node fires onSelect with its id', () => {
    const onSelect = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: 'Alpha chat' }))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('filtering by kind hides nodes of excluded kinds', () => {
    renderCanvas({ visibleKinds: ['app', 'chat'] as GraphNodeKind[] })
    expect(screen.queryByText('CRM mount')).toBeNull()
    expect(screen.getByText(/hidden by filter/)).toBeTruthy()
  })
})
