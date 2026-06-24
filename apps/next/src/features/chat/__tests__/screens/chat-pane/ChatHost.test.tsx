import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

let activeChatId: string | null = null
vi.mock('@/state/uiStore', () => ({
  useUiStore: (sel: (s: { activeChatId: string | null }) => unknown) => sel({ activeChatId }),
}))
const fetchChatSession = vi.fn(async (..._a: unknown[]) => ({ sessionId: 'sess-1' }))
vi.mock('@/core/chats', () => ({ fetchChatSession: (...a: unknown[]) => fetchChatSession(...a) }))
// Stub the pane so this test isolates ChatHost's select→resolve→mount logic.
vi.mock('@/features/chat/screens/chat-pane/ChatPaneScreen', () => ({
  ChatPaneScreen: (p: { chatId?: string; sessionId?: string }) => (
    <div data-testid="pane" data-chat={p.chatId} data-session={p.sessionId} />
  ),
}))

import { ChatHost } from '@/features/chat/screens/chat-pane/ChatHost'

afterEach(() => { activeChatId = null; vi.clearAllMocks() })

describe('ChatHost', () => {
  it('shows the empty state when no chat is selected', () => {
    activeChatId = null
    render(<ChatHost />)
    expect(screen.getByText('No chat selected')).toBeInTheDocument()
    expect(screen.queryByTestId('pane')).toBeNull()
  })

  it('mounts the chat pane with the resolved runner session when a chat is selected', async () => {
    activeChatId = 'chat-42'
    render(<ChatHost />)
    const pane = await screen.findByTestId('pane')
    expect(pane).toHaveAttribute('data-chat', 'chat-42')
    await waitFor(() => expect(pane).toHaveAttribute('data-session', 'sess-1'))
    expect(fetchChatSession).toHaveBeenCalledWith('chat-42')
  })
})
