import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeWorkspace } from '@/test/factories'
import { en } from '@/features/shell/i18n/en'
import { OrgSwitcher } from '@/features/shell/components/rail/OrgSwitcher'

const t = en.rail.org
const noop = () => {}
const asyncNoop = async () => {}

// Base props for the workspace-aware switcher; tests override what they exercise.
function props(overrides: Partial<Parameters<typeof OrgSwitcher>[0]> = {}) {
  return {
    orgs: [],
    workspaces: [],
    currentOrg: null,
    currentWorkspaceId: null,
    loading: false,
    disabled: false,
    canManage: false,
    onSwitchWorkspace: noop,
    onCreateWorkspace: asyncNoop,
    onCreateOrganization: asyncNoop,
    onOpenOrgSettings: noop,
    onOpenPeople: noop,
    onOpenBilling: noop,
    ...overrides,
  }
}

describe('OrgSwitcher', () => {
  it('shows a skeleton while loading', () => {
    renderWithProviders(<OrgSwitcher {...props({ loading: true })} />)
    expect(screen.getByLabelText(t.loading)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a skeleton (gated) while disabled', () => {
    renderWithProviders(<OrgSwitcher {...props({ disabled: true })} />)
    expect(screen.getByLabelText(t.loading)).toBeInTheDocument()
  })

  it('renders a non-interactive label when there is no org at all', () => {
    renderWithProviders(<OrgSwitcher {...props()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByLabelText(t.label)).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders the switcher button once there is at least one org', () => {
    const org = makeOrg({ name: 'Acme' })
    renderWithProviders(<OrgSwitcher {...props({ orgs: [org], currentOrg: org })} />)
    expect(screen.getByRole('button', { name: t.switch })).toBeInTheDocument()
  })

  it('opens the popover and lists the current org with its workspaces', async () => {
    const org = makeOrg({ name: 'Acme' })
    const ws = makeWorkspace({ name: 'Sales', organizationId: org.id })
    const { user } = renderWithProviders(
      <OrgSwitcher {...props({ orgs: [org], workspaces: [ws], currentOrg: org })} />,
    )
    await user.click(screen.getByRole('button', { name: t.switch }))
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    // Current org's disclosure is expanded by default → its workspace is visible.
    expect(await screen.findByRole('option', { name: 'Sales' })).toBeInTheDocument()
  })

  it('switches the active scope when a workspace is chosen', async () => {
    const org = makeOrg({ name: 'Acme' })
    const ws = makeWorkspace({ name: 'Sales', organizationId: org.id })
    const onSwitchWorkspace = vi.fn()
    const { user } = renderWithProviders(
      <OrgSwitcher {...props({ orgs: [org], workspaces: [ws], currentOrg: org, onSwitchWorkspace })} />,
    )
    await user.click(screen.getByRole('button', { name: t.switch }))
    await user.click(await screen.findByRole('option', { name: 'Sales' }))
    expect(onSwitchWorkspace).toHaveBeenCalledWith(org.id, ws.id)
  })

  it('shows the create-organization affordance only to managers', async () => {
    const org = makeOrg({ name: 'Acme', role: 'owner' })
    const { user, rerender } = renderWithProviders(
      <OrgSwitcher {...props({ orgs: [org], currentOrg: org, canManage: false })} />,
    )
    await user.click(screen.getByRole('button', { name: t.switch }))
    expect(screen.queryByRole('button', { name: t.newOrganization })).not.toBeInTheDocument()

    rerender(<OrgSwitcher {...props({ orgs: [org], currentOrg: org, canManage: true })} />)
    expect(await screen.findByRole('button', { name: t.newOrganization })).toBeInTheDocument()
  })
})
