import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const run = {
  messages: [] as unknown[],
  phase: 'idle' as const,
  isStreaming: false,
  loading: false,
  send: vi.fn(),
  cancel: vi.fn(),
  answer: vi.fn(),
  respondPermission: vi.fn(),
}
vi.mock('@/features/chat/hooks/useChatRun', () => ({ useChatRun: () => run }))
vi.mock('@/features/chat/hooks/useModelCatalog', () => ({ useModelCatalog: () => ({ models: [], loading: false }) }))

import { ChatPaneScreen } from '@/features/chat/screens/chat-pane/ChatPaneScreen'

afterEach(() => {
  vi.clearAllMocks()
  Object.assign(run, { messages: [], isStreaming: false, loading: false })
})

describe('ChatPaneScreen', () => {
  it('shows a loading skeleton while the transcript loads', () => {
    run.loading = true
    render(<ChatPaneScreen chatId="c1" sessionId="s1" />)
    expect(screen.getByTestId('chat-pane-loading')).toBeInTheDocument()
  })

  it('clears the draft when a send is accepted', async () => {
    run.send.mockResolvedValue({ kind: 'accepted', runId: 'r1', phase: 'preparing', duplicate: false })
    render(<ChatPaneScreen chatId="c1" sessionId="s1" />)
    const ta = screen.getByRole('textbox', { name: 'Message' })
    await userEvent.type(ta, 'build it')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    // Default selection (Auto mode/model → agentProfileId+model+provider omitted; effort → 'medium').
    expect(run.send).toHaveBeenCalledWith('build it', { agentProfileId: undefined, depthPresetId: 'medium', model: undefined, provider: undefined })
    expect((ta as HTMLTextAreaElement).value).toBe('')
  })

  it('restores the draft and shows a banner when a send is rejected', async () => {
    run.send.mockResolvedValue({ kind: 'rejected', code: 'writer_lock_conflict', message: 'Someone else is editing', retryAfterMs: null })
    render(<ChatPaneScreen chatId="c1" sessionId="s1" />)
    const ta = screen.getByRole('textbox', { name: 'Message' })
    await userEvent.type(ta, 'build it')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(screen.getByTestId('chat-rejection')).toHaveTextContent('Someone else is editing')
    expect((ta as HTMLTextAreaElement).value).toBe('build it')
  })

  it('disables the composer in read-only (viewer) mode', () => {
    render(<ChatPaneScreen chatId="c1" sessionId="s1" readOnly />)
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
  })
})
