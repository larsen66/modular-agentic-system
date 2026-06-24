import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThreadScreen } from '../ThreadScreen'
import { useUiStore } from '@/state/uiStore'
import { fetchChatThread } from '@/core/chats'

vi.mock('@/core/chats', () => ({
  fetchChatThread: vi.fn().mockResolvedValue({
    id: 'chat-1',
    title: 'Launch chat',
    status: 'active',
    appId: 'app-1',
    runnerSessionId: 'session-1',
    opencodeSessionId: null,
    summary: null,
    lastActivityAt: null,
    messages: [],
  }),
}))

const mockedFetchChatThread = vi.mocked(fetchChatThread)

function renderThreadScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThreadScreen />
    </QueryClientProvider>,
  )
}

describe('ThreadScreen', () => {
  beforeEach(() => {
    useUiStore.setState({ selectedNode: null, selectedNodeName: null })
    mockedFetchChatThread.mockResolvedValue({
      id: 'chat-1',
      title: 'Launch chat',
      status: 'active',
      appId: 'app-1',
      runnerSessionId: 'session-1',
      opencodeSessionId: null,
      summary: null,
      lastActivityAt: null,
      messages: [],
    })
  })

  it('renders selected node context from the Stage store', () => {
    useUiStore.setState({
      selectedNode: { kind: 'chat', id: 'chat-1', name: 'Launch chat' },
      selectedNodeName: 'Launch chat',
    })

    renderThreadScreen()

    expect(screen.getByText('Launch chat')).toBeInTheDocument()
    expect(screen.getByText(/Loaded chat context: Launch chat/)).toBeInTheDocument()
  })

  it('uses live thread messages instead of placeholder messages when present', async () => {
    mockedFetchChatThread.mockResolvedValue({
      id: 'chat-1',
      title: 'Launch chat',
      status: 'active',
      appId: 'app-1',
      runnerSessionId: 'session-1',
      opencodeSessionId: null,
      summary: null,
      lastActivityAt: null,
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          body: 'Live backend message',
          status: 'done',
          createdAt: '2026-06-12T05:00:00Z',
        },
      ],
    })
    useUiStore.setState({
      selectedNode: { kind: 'chat', id: 'chat-1', name: 'Launch chat' },
      selectedNodeName: 'Launch chat',
    })

    renderThreadScreen()

    expect(await screen.findByText('Live backend message')).toBeInTheDocument()
    expect(screen.queryByText('I am ready to work in this Stage pane.')).not.toBeInTheDocument()
  })

  it('adds a local draft message through the composer', () => {
    renderThreadScreen()

    const composer = screen.getByTestId('island-chat-composer')
    fireEvent.input(composer, { target: { value: 'Ship it' } })

    expect(composer).toHaveValue('Ship it')

    fireEvent.submit(screen.getByTestId('island-chat-form'))

    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText(/Draft received locally/)).toBeInTheDocument()
  })
})
