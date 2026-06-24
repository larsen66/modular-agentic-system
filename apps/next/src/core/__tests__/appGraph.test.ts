import { afterEach, describe, expect, it, vi } from 'vitest'

// A chainable, AWAITABLE query-builder stub: every filter returns the chain, and the chain itself is
// thenable so `await supabase.from(t).select().eq().eq()` resolves to the supplied result regardless
// of how many filters were chained (node_links chains two .eq; v_nodes ends on .limit).
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'limit', 'order']) {
    chain[m] = vi.fn((..._args: unknown[]) => chain)
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return chain
}

const fromMock = vi.fn()
vi.mock('@/core/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

const fetchProjectChats = vi.fn()
vi.mock('@/core/explorer', () => ({
  fetchProjects: vi.fn(),
  fetchProjectChats: (...a: unknown[]) => fetchProjectChats(...a),
}))

import { fetchAppGraph } from '@/core/appGraph'

afterEach(() => {
  fromMock.mockReset()
  fetchProjectChats.mockReset()
})

function wireTables(opts: {
  mounts?: { data: unknown; error: unknown }
  vnodes?: { data: unknown; error: unknown }
}) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'node_links') return makeChain(opts.mounts ?? { data: [], error: null })
    if (table === 'v_nodes') return makeChain(opts.vnodes ?? { data: [{ name: 'My App' }], error: null })
    throw new Error(`unexpected table ${table}`)
  })
}

describe('fetchAppGraph', () => {
  it('returns an EMPTY graph (never fabricated) when projectId is missing', async () => {
    const g = await fetchAppGraph(null)
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
    expect(g.source).toBe('links')
    expect(typeof g.generatedAt).toBe('string')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('builds containment graph: root app + chat nodes with `contains` edges', async () => {
    fetchProjectChats.mockResolvedValue([
      { id: 'c1', name: 'Main', kind: 'main', status: 'active', activityAt: null, workspaceId: null },
      { id: 'c2', name: 'Branch', kind: 'branch', status: 'active', activityAt: null, workspaceId: null },
    ])
    wireTables({})

    const g = await fetchAppGraph('proj-1')

    const root = g.nodes.find((n) => n.isRoot)
    expect(root).toMatchObject({ id: 'proj-1', kind: 'app', label: 'My App' })
    expect(g.nodes.filter((n) => n.kind === 'chat').map((n) => n.id)).toEqual(['c1', 'c2'])
    expect(g.edges).toContainEqual({ id: 'contains:proj-1:c1', source: 'proj-1', target: 'c1', kind: 'contains' })
    expect(g.edges).toContainEqual({ id: 'contains:proj-1:c2', source: 'proj-1', target: 'c2', kind: 'contains' })
  })

  it('adds `mounted-app` nodes + `mount` edges from node_links', async () => {
    fetchProjectChats.mockResolvedValue([])
    wireTables({
      mounts: {
        data: [{ source_node_id: 'proj-1', target_node_id: 'app-x', metadata: { label: 'CRM', icon: 'box' } }],
        error: null,
      },
    })

    const g = await fetchAppGraph('proj-1')

    expect(g.nodes).toContainEqual({ id: 'app-x', label: 'CRM', kind: 'mounted-app', path: null, icon: 'box' })
    expect(g.edges).toContainEqual({ id: 'mount:proj-1:app-x', source: 'proj-1', target: 'app-x', kind: 'mount' })
  })

  it('falls back to a generic root label when v_nodes lookup misses (still honest)', async () => {
    fetchProjectChats.mockResolvedValue([])
    wireTables({ vnodes: { data: [], error: null } })

    const g = await fetchAppGraph('proj-1')
    expect(g.nodes.find((n) => n.isRoot)?.label).toBe('This app')
  })

  it('throws when the mount-link query errors', async () => {
    fetchProjectChats.mockResolvedValue([])
    wireTables({ mounts: { data: null, error: { message: 'rls denied' } } })
    await expect(fetchAppGraph('proj-1')).rejects.toThrow(/rls denied/)
  })
})
