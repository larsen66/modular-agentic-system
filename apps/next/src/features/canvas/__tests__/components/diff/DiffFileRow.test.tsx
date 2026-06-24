import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RunDiffFile } from '@/core/runs'

vi.mock('@pierre/diffs', () => ({
  FileDiff: () => <div data-testid="file-diff-body" />,
  parseDiffFromFile: () => ({}),
  createCSSVariablesTheme: () => ({}),
}))

import { DiffFileRow } from '@/features/canvas/components/diff/DiffFileRow'

const file = (over: Partial<RunDiffFile> = {}): RunDiffFile => ({
  path: 'src/App.tsx', status: 'modified', additions: 12, deletions: 3, oldContents: 'a', newContents: 'b', ...over,
})

describe('DiffFileRow', () => {
  it('renders path, status label, and ± Chips', () => {
    render(<DiffFileRow file={file()} diffStyle="unified" isExpanded={false} />)
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument()
    expect(screen.getByText('Modified')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })

  it('shows the prev→new path for a rename', () => {
    render(<DiffFileRow file={file({ status: 'renamed', prevPath: 'a.ts', path: 'b.ts' })} diffStyle="unified" isExpanded={false} />)
    expect(screen.getByText('a.ts → b.ts')).toBeInTheDocument()
    expect(screen.getByText('Renamed')).toBeInTheDocument()
  })

  it('does NOT mount the diff body when collapsed (lazy)', () => {
    render(<DiffFileRow file={file()} diffStyle="unified" isExpanded={false} />)
    expect(screen.queryByTestId('file-diff-body')).not.toBeInTheDocument()
  })

  it('mounts the diff body when expanded', () => {
    render(<DiffFileRow file={file()} diffStyle="unified" isExpanded />)
    expect(screen.getByTestId('file-diff-body')).toBeInTheDocument()
  })

  it('omits a ± Chip when its count is 0', () => {
    render(<DiffFileRow file={file({ additions: 0, deletions: 5 })} diffStyle="unified" isExpanded={false} />)
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    expect(screen.getByText('−5')).toBeInTheDocument()
  })
})
