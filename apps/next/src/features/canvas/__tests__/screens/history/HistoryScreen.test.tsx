import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { RunHistoryEntry, RunDetail } from '@/core/history'

// The `core/history` seam is mocked so the screen's states are observable without Supabase.
const listRuns = vi.fn<(p: string, c?: string | null) => Promise<RunHistoryEntry[]>>()
const getRunDetail = vi.fn<(id: string) => Promise<RunDetail>>()
vi.mock('@/core/history', async () => {
  const actual = await vi.importActual<typeof import('@/core/history')>('@/core/history')
  return {
    ...actual,
    listRuns: (p: string, c?: string | null) => listRuns(p, c),
    getRunDetail: (id: string) => getRunDetail(id),
  }
})

// i18n: the `history` namespace is reported for the owner to add to en/de — stub it here so the
// screen renders in isolation (no edit to i18n/**).
vi.mock('@/features/canvas/i18n', () => ({
  useCanvasStrings: () => ({
    history: {
      runLabel: 'Run',
      timelineLabel: 'Run history',
      status: { started: 'Started', running: 'Running', succeeded: 'Succeeded', failed: 'Failed' },
      bucket: { completed: 'Applied', in_progress: 'In OPS', rejected: 'Rejected', notStarted: 'No proposal' },
      filesSummary: (n: number, a: number, d: number) => `${n} files · +${a} −${d}`,
      empty: { title: 'No history yet', description: 'Runs appear here after the agent makes changes.' },
      error: { title: 'Could not load history', description: 'Fetch failed.', action: 'Retry' },
      noSession: { title: 'No app selected', description: 'Open an app to see its history.' },
      honesty: { title: 'Nothing is applied here', description: 'Apply and rollback happen in OPS.' },
      actions: { viewDiff: 'View diff', openInOps: 'Open in OPS' },
      detail: {
        title: 'Run detail',
        metaLine: (t: string, m: string) => `${t} · ${m}`,
        unknownModel: 'Unknown model',
        session: 'Session',
        filesTable: 'Files changed',
        colFile: 'File', colAdds: 'Added', colDels: 'Removed', noFiles: 'No files changed.',
        emptyHint: { title: 'Select a run', description: 'Pick a run to see its detail.' },
      },
    },
  }),
}))

import { HistoryScreen } from '@/features/canvas/screens/history/HistoryScreen'

const entry = (over: Partial<RunHistoryEntry> = {}): RunHistoryEntry => ({
  id: 'r1', status: 'succeeded', createdAt: '2026-06-02T10:00:00Z', chatId: 'c1', sessionId: 's1',
  filesChanged: 2, additions: 5, deletions: 1, proposalId: 'p1', proposalBucket: 'in_progress', ...over,
})
const runDetail = (over: Partial<RunDetail> = {}): RunDetail => ({
  id: 'r1', status: 'succeeded', createdAt: '2026-06-02T10:00:00Z', chatId: 'c1', sessionId: 's1',
  model: 'opus', files: [{ file: 'a.ts', additions: 5, deletions: 1 }], additions: 5, deletions: 1,
  proposalId: 'p1', proposalBucket: 'in_progress', ...over,
})

afterEach(() => {
  listRuns.mockReset()
  getRunDetail.mockReset()
})

describe('HistoryScreen', () => {
  it('shows the no-session panel without a project', () => {
    renderWithProviders(<HistoryScreen projectId={null} />)
    expect(screen.getByText('No app selected')).toBeInTheDocument()
  })

  it('shows the empty state when there are no runs', async () => {
    listRuns.mockResolvedValue([])
    renderWithProviders(<HistoryScreen projectId="proj-1" />)
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
  })

  it('shows an error panel + retry when the list fails', async () => {
    listRuns.mockRejectedValue(new Error('boom'))
    const { user } = renderWithProviders(<HistoryScreen projectId="proj-1" />)
    expect(await screen.findByText('Could not load history')).toBeInTheDocument()
    listRuns.mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
  })

  it('renders rows and auto-selects the newest run into the detail (with honesty alert)', async () => {
    listRuns.mockResolvedValue([entry()])
    getRunDetail.mockResolvedValue(runDetail())
    renderWithProviders(<HistoryScreen projectId="proj-1" />)

    expect(await screen.findByText('Run detail')).toBeInTheDocument()
    expect(screen.getByText('Nothing is applied here')).toBeInTheDocument()
    expect(getRunDetail).toHaveBeenCalledWith('r1')
  })

  it('View diff deep-links to the diff view; Open in OPS uses the proposal callback', async () => {
    listRuns.mockResolvedValue([entry()])
    getRunDetail.mockResolvedValue(runDetail())
    const onViewDiff = vi.fn()
    const onOpenInOps = vi.fn()
    const { user } = renderWithProviders(
      <HistoryScreen projectId="proj-1" onViewDiff={onViewDiff} onOpenInOps={onOpenInOps} />,
    )
    await screen.findByText('Run detail')
    await user.click(screen.getByRole('button', { name: /View diff/ }))
    expect(onViewDiff).toHaveBeenCalledWith('r1')
    await user.click(screen.getByRole('button', { name: /Open in OPS/ }))
    expect(onOpenInOps).toHaveBeenCalledWith('p1')
  })

  it('disables Open in OPS when the run has no proposal, View diff when no files', async () => {
    listRuns.mockResolvedValue([entry({ proposalId: null, proposalBucket: 'notStarted', filesChanged: 0 })])
    getRunDetail.mockResolvedValue(runDetail({ proposalId: null, proposalBucket: 'notStarted', files: [] }))
    renderWithProviders(<HistoryScreen projectId="proj-1" />)
    await screen.findByText('Run detail')
    expect(screen.getByRole('button', { name: /Open in OPS/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /View diff/ })).toBeDisabled()
  })
})
