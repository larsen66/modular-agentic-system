import { afterEach, describe, expect, it, vi } from 'vitest'

// A chainable query-builder stub: every filter returns the chain; `.order()` is terminal and
// resolves to the supplied result. Records the calls so we can assert the RLS query shape.
function makeChain(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const record = (name: string, args: unknown[]) => {
    calls[name] = args
  }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in']) {
    chain[m] = vi.fn((...args: unknown[]) => {
      record(m, args)
      return chain
    })
  }
  chain.order = vi.fn((...args: unknown[]) => {
    record('order', args)
    return Promise.resolve(result)
  })
  chain._calls = calls
  return chain
}

const fromMock = vi.fn()
vi.mock('@/core/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
import { fetchProjects, fetchProjectChats } from '@/core/explorer'

afterEach(() => fromMock.mockReset())

describe('fetchProjects', () => {
  it('queries v_nodes for the workspace, apps+folders, newest first', async () => {
    const chain = makeChain({
      data: [
        { source_id: 'a1', name: 'App', icon: 'box', kind: 'app', updated_at: '2026-01-02' },
        { source_id: 'f1', name: 'Folder', icon: null, kind: 'folder', updated_at: '2026-01-01' },
      ],
      error: null,
    })
    fromMock.mockReturnValue(chain)

    const result = await fetchProjects('ws-1')

    expect(fromMock).toHaveBeenCalledWith('v_nodes')
    expect((chain._calls as Record<string, unknown[]>).eq).toEqual(['workspace_id', 'ws-1'])
    expect((chain._calls as Record<string, unknown[]>).in).toEqual(['kind', ['app', 'folder']])
    expect((chain._calls as Record<string, unknown[]>).order).toEqual([
      'updated_at',
      { ascending: false },
    ])
    expect(result).toEqual([
      { id: 'a1', name: 'App', icon: 'box', entityType: 'app', updatedAt: '2026-01-02' },
      { id: 'f1', name: 'Folder', icon: null, entityType: 'folder', updatedAt: '2026-01-01' },
    ])
  })

  it('throws on a query error', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: { message: 'rls denied' } }))
    await expect(fetchProjects('ws-1')).rejects.toThrow(/rls denied/)
  })
})

describe('fetchProjectChats', () => {
  it('orders by last_activity_at and filters archived rows client-side', async () => {
    const chain = makeChain({
      data: [
        { id: 'c1', title: 'Live', kind: 'main', status: 'active', last_activity_at: '2026-02-02' },
        { id: 'c2', title: 'Old', kind: 'branch', status: 'archived', last_activity_at: '2026-02-01' },
      ],
      error: null,
    })
    fromMock.mockReturnValue(chain)

    const result = await fetchProjectChats('proj-1')

    expect(fromMock).toHaveBeenCalledWith('project_chats')
    expect((chain._calls as Record<string, unknown[]>).order).toEqual([
      'last_activity_at',
      { ascending: false },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'c1', name: 'Live', status: 'active' })
  })

  it('falls back to last_message_at / created_at for activityAt', async () => {
    fromMock.mockReturnValue(
      makeChain({
        data: [{ id: 'c1', title: '', status: 'active', last_message_at: '2026-03-03' }],
        error: null,
      }),
    )
    const [chat] = await fetchProjectChats('proj-1')
    expect(chat.name).toBe('Untitled chat')
    expect(chat.activityAt).toBe('2026-03-03')
  })

  it('throws on a query error', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }))
    await expect(fetchProjectChats('proj-1')).rejects.toThrow(/boom/)
  })
})
