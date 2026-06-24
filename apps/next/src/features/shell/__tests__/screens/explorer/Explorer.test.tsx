import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeUser } from '@/test/factories'
import { useUiStore } from '@/state/uiStore'
import { en } from '@/features/shell/i18n/en'

const getCurrentUser = vi.fn()
vi.mock('@/core/session', () => ({
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  onAuthChange: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('@/core/orgs', () => ({ fetchOrganizations: vi.fn() }))
vi.mock('@/core/workspaces', () => ({ fetchWorkspacesForOrgs: vi.fn().mockResolvedValue([]) }))
vi.mock('@/core/explorer', () => ({
  fetchProjects: vi.fn().mockResolvedValue([]),
  fetchProjectChats: vi.fn().mockResolvedValue([]),
}))
import { fetchOrganizations } from '@/core/orgs'
import { Explorer } from '@/features/shell/screens/explorer/Explorer'

const t = en.explorer

beforeEach(() => {
  useUiStore.setState({ activeMode: 'explorer', explorerView: 'nodes', activeNodeId: null, activeOrgId: null })
  getCurrentUser.mockReset().mockResolvedValue(
    makeUser({ user_metadata: { full_name: 'Ada Lovelace' }, email: 'ada@example.com' }),
  )
  vi.mocked(fetchOrganizations).mockResolvedValue([makeOrg({ name: 'Acme' })])
})

describe('Explorer screen', () => {
  it('labels the Nodes tab as the user’s BOS', async () => {
    renderWithProviders(<Explorer />)
    expect(await screen.findByRole('tab', { name: "Ada's BOS" })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t.tabs.chats })).toBeInTheDocument()
  })

  it('falls back to the generic Nodes label when the user has no name', async () => {
    getCurrentUser.mockReset().mockResolvedValue(makeUser({ user_metadata: {}, email: undefined }))
    renderWithProviders(<Explorer />)
    expect(await screen.findByRole('tab', { name: t.tabs.nodes })).toBeInTheDocument()
  })

  it('switches to the Chats view and shows its empty-state with no project selected', async () => {
    const { user } = renderWithProviders(<Explorer />)
    await user.click(screen.getByRole('tab', { name: t.tabs.chats }))
    await waitFor(() => expect(useUiStore.getState().explorerView).toBe('chats'))
    expect(await screen.findByText(t.empty.chatsTab)).toBeInTheDocument()
  })

  it('renders an honest empty-state for a moved mode (e.g. People)', () => {
    useUiStore.setState({ activeMode: 'people' })
    renderWithProviders(<Explorer />)
    expect(screen.getByText(t.modeUnavailable)).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
