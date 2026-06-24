import { afterEach, describe, expect, it, vi } from 'vitest'

// Per-table chain stub. Each `.from(table)` returns a fresh chain whose terminal resolves to the
// queued result for that table. `.order().limit()` and `.maybeSingle()` and bare `.in()`/`.eq()`
// awaits all resolve. We queue results FIFO per table so listRuns' multi-round-trip joins resolve.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const thenable = Promise.resolve(result)
  for (const m of ['select', 'eq', 'in']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Allow bare `await query` (the version_intents/ops_proposals IN-queries end on `.in()`).
  chain.then = thenable.then.bind(thenable)
  return chain
}

const results: Record<string, Array<{ data: unknown; error: unknown }>> = {}
const fromMock = vi.fn((table: string) => {
  const queue = results[table] ?? []
  const next = queue.shift() ?? { data: [], error: null }
  return makeChain(next)
})
function queue(table: string, ...res: Array<{ data: unknown; error: unknown }>) {
  results[table] = res
}

vi.mock('@/core/supabase', () => ({ supabase: { from: (t: string) => fromMock(t) } }))
import {
  listRuns,
  getRunDetail,
  buildOpsProposalPath,
  bucketProposalStatus,
} from '@/core/history'

afterEach(() => {
  fromMock.mockClear()
  for (const k of Object.keys(results)) delete results[k]
})

describe('bucketProposalStatus', () => {
  it('maps live statuses to buckets (legacy partialRunRecovery cases)', () => {
    expect(bucketProposalStatus('applied')).toBe('completed')
    expect(bucketProposalStatus('pending')).toBe('in_progress')
    expect(bucketProposalStatus('approved')).toBe('in_progress')
    expect(bucketProposalStatus('rejected')).toBe('rejected')
    expect(bucketProposalStatus(null)).toBe('notStarted')
    expect(bucketProposalStatus(undefined)).toBe('notStarted')
  })
})

describe('listRuns', () => {
  it('maps run rows, derives ± totals, and buckets the linked proposal', async () => {
    queue('runs', {
      data: [
        {
          id: 'r1',
          status: 'succeeded',
          chat_id: 'c1',
          session_id: 's1',
          created_at: '2026-06-02',
          started_at: '2026-06-02',
          summary: { enrichment: { diff: [{ file: 'a.ts', additions: 3, deletions: 1 }] } },
        },
        {
          id: 'r2',
          status: 'failed',
          chat_id: 'c1',
          session_id: 's1',
          created_at: '2026-06-01',
          summary: {},
        },
      ],
      error: null,
    })
    queue('version_intents', {
      data: [{ run_id: 'r1', proposal_id: 'p1' }],
      error: null,
    })
    queue('ops_proposals', {
      data: [{ id: 'p1', status: 'applied' }],
      error: null,
    })

    const rows = await listRuns('proj-1')

    expect(fromMock).toHaveBeenCalledWith('runs')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 'r1',
      status: 'succeeded',
      filesChanged: 1,
      additions: 3,
      deletions: 1,
      proposalId: 'p1',
      proposalBucket: 'completed',
    })
    expect(rows[1]).toMatchObject({
      id: 'r2',
      filesChanged: 0,
      proposalId: null,
      proposalBucket: 'notStarted',
    })
  })

  it('skips the join round-trips when there are no runs', async () => {
    queue('runs', { data: [], error: null })
    const rows = await listRuns('proj-1', 'chat-x')
    expect(rows).toEqual([])
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('throws on a query error', async () => {
    queue('runs', { data: null, error: { message: 'rls denied' } })
    await expect(listRuns('proj-1')).rejects.toThrow(/rls denied/)
  })
})

describe('getRunDetail', () => {
  it('shapes the per-file diff and proposal bucket', async () => {
    queue('runs', {
      data: {
        id: 'r1',
        status: 'succeeded',
        chat_id: 'c1',
        session_id: 's1',
        created_at: '2026-06-02',
        summary: {
          model: 'opus',
          enrichment: {
            diff: [
              { file: 'a.ts', additions: 3, deletions: 1 },
              { file: 'b.ts', additions: 2, deletions: 0 },
            ],
          },
        },
      },
      error: null,
    })
    queue('version_intents', { data: [{ proposal_id: 'p1' }], error: null })
    queue('ops_proposals', { data: { status: 'pending' }, error: null })

    const detail = await getRunDetail('r1')

    expect(detail).toMatchObject({
      id: 'r1',
      model: 'opus',
      additions: 5,
      deletions: 1,
      proposalId: 'p1',
      proposalBucket: 'in_progress',
    })
    expect(detail.files).toHaveLength(2)
  })

  it('throws when the run is not found', async () => {
    queue('runs', { data: null, error: null })
    await expect(getRunDetail('missing')).rejects.toThrow(/not found/)
  })
})

describe('buildOpsProposalPath', () => {
  it('builds the governed OPS deep-link', () => {
    expect(buildOpsProposalPath('p-123')).toBe('/ops/proposals/p-123')
  })
})
