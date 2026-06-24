import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { RunDiff, RunDiffFile } from '@/core/runs'

// The `core/runs` seam is mocked so the screen's states are observable without a runner. `@pierre/diffs`
// is stubbed (its worker/Shiki renderer is irrelevant to chrome behavior + heavy in jsdom).
const getRunDiff = vi.fn<(id: string) => Promise<RunDiff>>()
vi.mock('@/core/runs', async () => {
  const actual = await vi.importActual<typeof import('@/core/runs')>('@/core/runs')
  return { ...actual, getRunDiff: (id: string) => getRunDiff(id) }
})
vi.mock('@pierre/diffs', () => ({
  FileDiff: ({ fileDiff }: { fileDiff: unknown }) => (
    <div data-testid="file-diff-body">{JSON.stringify(Boolean(fileDiff))}</div>
  ),
  parseDiffFromFile: () => ({ marker: 'parsed' }),
  createCSSVariablesTheme: () => ({}),
}))

import { DiffScreen } from '@/features/canvas/screens/diff/DiffScreen'

const file = (over: Partial<RunDiffFile> = {}): RunDiffFile => ({
  path: 'src/App.tsx', status: 'modified', additions: 12, deletions: 3, oldContents: 'a', newContents: 'b', ...over,
})

afterEach(() => getRunDiff.mockReset())

describe('DiffScreen', () => {
  it('shows the no-run state when no runId', () => {
    renderWithProviders(<DiffScreen runId={null} />)
    expect(screen.getByText('No run selected')).toBeInTheDocument()
    expect(getRunDiff).not.toHaveBeenCalled()
  })

  it('renders header counts + Σ± and a row per file', async () => {
    getRunDiff.mockResolvedValue({
      runId: 'r1',
      files: [file(), file({ path: 'src/new.ts', status: 'added', additions: 40, deletions: 0, oldContents: '' })],
    })
    renderWithProviders(<DiffScreen runId="r1" />)
    await waitFor(() => expect(screen.getByText('2 files changed')).toBeInTheDocument())
    expect(screen.getByText('+52')).toBeInTheDocument() // 12 + 40
    // header total −3 + the App.tsx row both read "−3"
    expect(screen.getAllByText('−3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument()
    expect(screen.getByText('src/new.ts')).toBeInTheDocument()
  })

  it('renders the no-changes (empty) state for 0 files', async () => {
    getRunDiff.mockResolvedValue({ runId: 'r1', files: [] })
    renderWithProviders(<DiffScreen runId="r1" />)
    await waitFor(() => expect(screen.getByText('No changes')).toBeInTheDocument())
  })

  it('renders the error state with a retry that refetches', async () => {
    getRunDiff.mockRejectedValueOnce(new Error('boom'))
    renderWithProviders(<DiffScreen runId="r1" />)
    await waitFor(() => expect(screen.getByText('Couldn’t load changes')).toBeInTheDocument())

    getRunDiff.mockResolvedValueOnce({ runId: 'r1', files: [file()] })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('1 file changed')).toBeInTheDocument())
  })

  it('lazily mounts the diff body only for expanded files (≤5 auto-expanded)', async () => {
    getRunDiff.mockResolvedValue({ runId: 'r1', files: [file()] })
    renderWithProviders(<DiffScreen runId="r1" />)
    // Small set → auto-expanded → body mounted.
    await waitFor(() => expect(screen.getByTestId('file-diff-body')).toBeInTheDocument())
  })

  it('collapse-all hides the body; expand-all brings it back', async () => {
    getRunDiff.mockResolvedValue({ runId: 'r1', files: [file()] })
    renderWithProviders(<DiffScreen runId="r1" />)
    await waitFor(() => expect(screen.getByTestId('file-diff-body')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    await waitFor(() => expect(screen.queryByTestId('file-diff-body')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await waitFor(() => expect(screen.getByTestId('file-diff-body')).toBeInTheDocument())
  })
})
