import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppGraph } from '@/core/appGraph'
import type { GraphViewState } from '@/features/canvas/types/graph'

// Drive the screen via a mocked useAppGraph so each state is observable without a runner/Supabase.
const useAppGraph = vi.fn()
vi.mock('@/features/canvas/screens/graph/useAppGraph', () => ({
  useAppGraph: (...a: unknown[]) => useAppGraph(...a),
}))

import { GraphScreen } from '@/features/canvas/screens/graph/GraphScreen'

function wire(state: GraphViewState, graph: AppGraph | null, error: string | null = null) {
  const refresh = vi.fn()
  useAppGraph.mockReturnValue({ state, graph, error, refresh })
  return refresh
}

const populated: AppGraph = {
  source: 'links',
  generatedAt: '2026-06-15T00:00:00Z',
  nodes: [
    { id: 'p1', label: 'My App', kind: 'app', path: null, icon: null, isRoot: true },
    { id: 'c1', label: 'Main chat', kind: 'chat', path: null, icon: null },
  ],
  edges: [{ id: 'contains:p1:c1', source: 'p1', target: 'c1', kind: 'contains' }],
}

afterEach(() => useAppGraph.mockReset())

describe('GraphScreen states', () => {
  it('no_session → no-session panel (never a fabricated graph)', () => {
    wire('no_session', null)
    render(<GraphScreen projectId={null} />)
    expect(screen.getByText('No app to map yet')).toBeTruthy()
    expect(screen.queryByTestId('graph-canvas')).toBeNull()
  })

  it('loading → spinner + skeletons', () => {
    wire('loading', null)
    render(<GraphScreen projectId="p1" />)
    expect(screen.getByText('Mapping your app…')).toBeTruthy()
  })

  it('empty → empty panel with refresh', () => {
    const refresh = wire('empty', { ...populated, nodes: [], edges: [] })
    render(<GraphScreen projectId="p1" />)
    expect(screen.getByText('Nothing to map yet')).toBeTruthy()
    fireEvent.click(screen.getByText('Refresh'))
    expect(refresh).toHaveBeenCalled()
  })

  it('error → Alert + Retry', () => {
    const refresh = wire('error', null, 'boom')
    render(<GraphScreen projectId="p1" />)
    expect(screen.getByText('Couldn’t build the graph')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
    fireEvent.click(screen.getByText('Retry'))
    expect(refresh).toHaveBeenCalled()
  })

  it('populated → canvas + toolbar counts + legend', () => {
    wire('populated', populated)
    render(<GraphScreen projectId="p1" />)
    expect(screen.getByTestId('graph-canvas')).toBeTruthy()
    expect(screen.getByText('2 nodes')).toBeTruthy()
    expect(screen.getByText('1 edge')).toBeTruthy()
    expect(screen.getByText('Legend')).toBeTruthy()
  })

  it('selecting a node opens the detail drawer; Open file disabled for demo (codeAuthority none)', () => {
    wire('populated', populated)
    render(<GraphScreen projectId="p1" codeAuthority="none" />)
    fireEvent.click(screen.getByRole('button', { name: 'My App' }))
    const openBtn = screen.getByText('Open file').closest('button')
    expect(openBtn?.disabled).toBe(true)
  })
})
