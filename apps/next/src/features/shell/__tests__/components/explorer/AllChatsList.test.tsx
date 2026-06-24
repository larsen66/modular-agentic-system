import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useUiStore } from '@/state/uiStore'
import type { ChatNode } from '@/core/explorer'
import { en } from '@/features/shell/i18n/en'

vi.mock('@/core/explorer', () => ({ fetchProjectChats: vi.fn(), fetchProjects: vi.fn() }))
import { fetchProjectChats } from '@/core/explorer'
import { AllChatsList } from '@/features/shell/components/explorer/AllChatsList'

const mockChats = vi.mocked(fetchProjectChats)
const t = en.explorer

beforeEach(() => useUiStore.setState({ activeNodeId: null, activeChatId: null }))
afterEach(() => mockChats.mockReset())

const oneChat: ChatNode[] = [
  { id: 'c-1', name: 'Onboarding', kind: 'main', status: 'active', activityAt: null, workspaceId: null },
]

describe('AllChatsList', () => {
  it('asks the user to pick a project when none is active', () => {
    renderWithProviders(<AllChatsList />)
    expect(screen.getByText(t.empty.chatsTab)).toBeInTheDocument()
    expect(mockChats).not.toHaveBeenCalled()
  })

  it('lists the active project’s chats', async () => {
    mockChats.mockResolvedValue(oneChat)
    useUiStore.setState({ activeNodeId: 'p-1' })
    renderWithProviders(<AllChatsList />)
    expect(await screen.findByRole('button', { name: 'Onboarding' })).toBeInTheDocument()
  })

  it('shows the empty-state when the active project has no chats', async () => {
    mockChats.mockResolvedValue([])
    useUiStore.setState({ activeNodeId: 'p-1' })
    renderWithProviders(<AllChatsList />)
    expect(await screen.findByText(t.empty.chats)).toBeInTheDocument()
  })
})
