import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunDiffFile } from '@/core/runs'

// Stub the 3rd-party renderer: capture the props the wrapper passes (diffStyle, disableFileHeader,
// theme) and the FileContents handed to parseDiffFromFile.
const fileDiffProps = vi.fn()
const parseArgs = vi.fn()
vi.mock('@pierre/diffs', () => ({
  FileDiff: (props: Record<string, unknown>) => {
    fileDiffProps(props)
    return <div data-testid="file-diff-body" />
  },
  parseDiffFromFile: (oldFile: unknown, newFile: unknown) => {
    parseArgs(oldFile, newFile)
    return { marker: 'parsed' }
  },
  createCSSVariablesTheme: () => ({ name: 'canvas-diff' }),
}))

import { DiffFileBody } from '@/features/canvas/components/diff/DiffFileBody'

const file = (over: Partial<RunDiffFile> = {}): RunDiffFile => ({
  path: 'src/App.tsx', status: 'modified', additions: 1, deletions: 1, oldContents: 'a', newContents: 'b', ...over,
})

afterEach(() => {
  fileDiffProps.mockReset()
  parseArgs.mockReset()
})

describe('DiffFileBody', () => {
  it('passes diffStyle + disableFileHeader:true + theme to FileDiff', () => {
    render(<DiffFileBody file={file()} diffStyle="split" />)
    const props = fileDiffProps.mock.calls[0][0]
    expect(props.options.diffStyle).toBe('split')
    expect(props.options.disableFileHeader).toBe(true)
    expect(props.options.theme).toBeTruthy()
  })

  it('feeds old/new FileContents to parseDiffFromFile (added → old="")', () => {
    render(<DiffFileBody file={file({ status: 'added', oldContents: '', newContents: 'x' })} diffStyle="unified" />)
    const [oldFile, newFile] = parseArgs.mock.calls[0]
    expect(oldFile.contents).toBe('')
    expect(newFile.contents).toBe('x')
  })

  it('uses prevPath as the old file name for a rename', () => {
    render(<DiffFileBody file={file({ status: 'renamed', prevPath: 'a.ts', path: 'b.ts' })} diffStyle="unified" />)
    const [oldFile, newFile] = parseArgs.mock.calls[0]
    expect(oldFile.name).toBe('a.ts')
    expect(newFile.name).toBe('b.ts')
  })

  it('content-unavailable (null) → header-only Chip, no FileDiff mount', () => {
    render(<DiffFileBody file={file({ oldContents: null, newContents: null })} diffStyle="unified" />)
    expect(screen.queryByTestId('file-diff-body')).not.toBeInTheDocument()
    expect(screen.getByText('Content unavailable')).toBeInTheDocument()
    expect(parseArgs).not.toHaveBeenCalled()
  })
})
