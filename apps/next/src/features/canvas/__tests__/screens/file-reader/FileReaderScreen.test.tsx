import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the core file seam (read/write/subscribe) so the screen test exercises behaviour, not HTTP.
const readFile = vi.fn()
const writeFiles = vi.fn()
const subscribeFileChanges = vi.fn(() => () => {})
vi.mock('@/core/files', () => ({
  readFile: (...a: unknown[]) => (readFile as (...x: unknown[]) => unknown)(...a),
  writeFiles: (...a: unknown[]) => (writeFiles as (...x: unknown[]) => unknown)(...a),
  subscribeFileChanges: (...a: unknown[]) => (subscribeFileChanges as (...x: unknown[]) => unknown)(...a),
}))
vi.mock('@/core/runner', () => ({ RunnerError: class RunnerError extends Error {} }))

// Supply the file-reader strings (integrator adds these to the real EN/DE maps).
vi.mock('@/features/canvas/i18n', () => ({
  useCanvasStrings: () => ({
    fileReader: {
      edit: 'Edit', editTip: 'Edit', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
      updated: '• updated', saveFailed: 'Save failed', readFailed: 'Could not read file',
      dismiss: 'Dismiss', empty: '(empty file)', noRows: '(no rows)', loading: 'Loading {name}…',
      tableView: 'Table', rawView: 'Raw', viewToggle: 'View', tableLabel: 'File rows',
      columnPrefix: 'col', truncated: 'Showing first {shown} of {total} rows.',
      noSession: { title: 'No running session yet', description: 'Start a chat.' },
    },
  }),
}))

import { FileReaderScreen } from '@/features/canvas/screens/file-reader/FileReaderScreen'

const baseProps = { path: 'src/App.tsx', name: 'App.tsx', sessionId: 's1', projectId: 'p1' }

beforeEach(() => {
  readFile.mockResolvedValue({ content: 'const x = 1' })
  writeFiles.mockResolvedValue({ ok: true })
})
afterEach(() => {
  readFile.mockReset()
  writeFiles.mockReset()
})

describe('FileReaderScreen', () => {
  it('renders code content after a successful read', async () => {
    render(<FileReaderScreen {...baseProps} codeAuthority="none" />)
    expect(await screen.findByText('const x = 1')).toBeInTheDocument()
  })

  it('shows the read error as a danger alert', async () => {
    readFile.mockRejectedValue(new Error('boom'))
    render(<FileReaderScreen {...baseProps} codeAuthority="none" />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('renders an empty-file note', async () => {
    readFile.mockResolvedValue({ content: '' })
    render(<FileReaderScreen {...baseProps} codeAuthority="none" />)
    expect(await screen.findByText('(empty file)')).toBeInTheDocument()
  })

  it('shows the no-session degraded panel when there is no session', () => {
    render(<FileReaderScreen {...baseProps} sessionId={null} codeAuthority="write" />)
    expect(screen.getByText('No running session yet')).toBeInTheDocument()
  })

  it('hides Edit for a repo:* (read-only) root', async () => {
    render(<FileReaderScreen {...baseProps} rootId="repo:r1" codeAuthority="write" />)
    await screen.findByText('const x = 1')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('hides Edit when codeAuthority is none even on a writable root', async () => {
    render(<FileReaderScreen {...baseProps} rootId="app:p1" codeAuthority="none" />)
    await screen.findByText('const x = 1')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('offers Edit on a writable root with authority, and saves successfully', async () => {
    const user = userEvent.setup()
    render(<FileReaderScreen {...baseProps} rootId="app:p1" codeAuthority="write" />)
    await screen.findByText('const x = 1')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(writeFiles).toHaveBeenCalledWith({
        sessionId: 's1',
        files: [{ path: 'src/App.tsx', content: 'const x = 1', rootId: 'app:p1' }],
      })
    })
  })

  it('keeps edit mode and shows a danger alert on save failure', async () => {
    const user = userEvent.setup()
    writeFiles.mockResolvedValue({ ok: false, error: 'read-only root', status: 403 })
    render(<FileReaderScreen {...baseProps} rootId="app:p1" codeAuthority="write" />)
    await screen.findByText('const x = 1')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('read-only root')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
