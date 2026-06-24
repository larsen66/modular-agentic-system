import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeWorkspace } from '@/test/factories'
import { en } from '@/features/shell/i18n/en'

vi.mock('@/core/workspaces', () => ({ fetchWorkspacesForOrgs: vi.fn() }))
vi.mock('@/core/explorer', () => ({ fetchProjects: vi.fn().mockResolvedValue([]), fetchProjectChats: vi.fn() }))
import { fetchWorkspacesForOrgs } from '@/core/workspaces'
import { NodeTree } from '@/features/shell/components/explorer/NodeTree'

const mockWs = vi.mocked(fetchWorkspacesForOrgs)
const t = en.explorer

afterEach(() => mockWs.mockReset())

describe('NodeTree', () => {
  it('shows the empty-state when the org has no workspaces', async () => {
    mockWs.mockResolvedValue([])
    renderWithProviders(<NodeTree orgId="org-1" />)
    expect(await screen.findByText(t.empty.workspaces)).toBeInTheDocument()
  })

  it('renders a branch per workspace', async () => {
    mockWs.mockResolvedValue([
      makeWorkspace({ name: 'Sales', organizationId: 'org-1' }),
      makeWorkspace({ name: 'Ops', organizationId: 'org-1' }),
    ])
    renderWithProviders(<NodeTree orgId="org-1" />)
    expect(await screen.findByRole('button', { name: 'Sales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ops' })).toBeInTheDocument()
  })

  it('shows an inline error with retry when the tree query fails', async () => {
    mockWs.mockRejectedValue(new Error('rls denied'))
    renderWithProviders(<NodeTree orgId="org-1" />)
    await waitFor(() => expect(screen.getByText(t.empty.error)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: t.retry })).toBeInTheDocument()
  })

  it('does not query without an org id', async () => {
    renderWithProviders(<NodeTree orgId={null} />)
    expect(await screen.findByText(t.empty.workspaces)).toBeInTheDocument()
    expect(mockWs).not.toHaveBeenCalled()
  })
})
