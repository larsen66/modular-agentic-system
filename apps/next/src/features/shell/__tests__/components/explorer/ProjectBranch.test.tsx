import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useUiStore } from '@/state/uiStore'
import type { ChatNode, ProjectNode } from '@/core/explorer'

vi.mock('@/core/explorer', () => ({ fetchProjectChats: vi.fn(), fetchProjects: vi.fn() }))
import { fetchProjectChats } from '@/core/explorer'
import { ProjectBranch } from '@/features/shell/components/explorer/ProjectBranch'

const mockChats = vi.mocked(fetchProjectChats)
const project: ProjectNode = { id: 'p-1', name: 'Checkout', icon: null, entityType: 'app', updatedAt: null }

function chats(n: number): ChatNode[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c-${i + 1}`,
    name: `Chat ${i + 1}`,
    kind: 'main',
    status: 'active',
    activityAt: null,
    workspaceId: 'ws-1',
  }))
}

beforeEach(() => {
  useUiStore.setState({ activeNodeId: null, activeChatId: null })
})
afterEach(() => mockChats.mockReset())

describe('ProjectBranch', () => {
  it('does not load chats until the project is expanded', () => {
    mockChats.mockResolvedValue(chats(1))
    renderWithProviders(<ProjectBranch project={project} workspaceId="ws-1" />)
    expect(mockChats).not.toHaveBeenCalled()
  })

  it('selects the project and lazy-loads its chats on press', async () => {
    mockChats.mockResolvedValue(chats(2))
    const { user } = renderWithProviders(<ProjectBranch project={project} workspaceId="ws-1" />)

    await user.click(screen.getByRole('button', { name: 'Checkout' }))
    expect(useUiStore.getState().activeNodeId).toBe('p-1')
    await waitFor(() => expect(mockChats).toHaveBeenCalledWith('p-1', 'ws-1'))
    expect(await screen.findByRole('button', { name: 'Chat 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chat 2' })).toBeInTheDocument()
  })

  it('caps at 5 chats with a "Show more" that reveals the rest', async () => {
    mockChats.mockResolvedValue(chats(7))
    const { user } = renderWithProviders(<ProjectBranch project={project} workspaceId="ws-1" />)

    await user.click(screen.getByRole('button', { name: 'Checkout' }))
    await screen.findByRole('button', { name: 'Chat 1' })
    // 5 visible, Chat 6/7 hidden behind "Show more (2)".
    expect(screen.queryByRole('button', { name: 'Chat 6' })).not.toBeInTheDocument()
    const showMore = screen.getByRole('button', { name: /Show more \(2\)/ })

    await user.click(showMore)
    expect(await screen.findByRole('button', { name: 'Chat 7' })).toBeInTheDocument()
  })

  it('selects a chat (and its project) when a chat row is pressed', async () => {
    mockChats.mockResolvedValue(chats(1))
    const { user } = renderWithProviders(<ProjectBranch project={project} workspaceId="ws-1" />)
    await user.click(screen.getByRole('button', { name: 'Checkout' }))
    await user.click(await screen.findByRole('button', { name: 'Chat 1' }))
    expect(useUiStore.getState().activeNodeId).toBe('p-1')
    expect(useUiStore.getState().activeChatId).toBe('c-1')
  })
})
