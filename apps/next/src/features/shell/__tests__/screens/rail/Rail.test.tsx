import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeUser } from '@/test/factories'
import { useUiStore } from '@/state/uiStore'
import { en } from '@/features/shell/i18n/en'

// Mock every core seam the Rail's hooks read — the screen test exercises composition + wiring,
// not the backend. A never-resolving session promise lets us hold the readiness gate open.
const getCurrentUser = vi.fn()
const onAuthChange = vi.fn().mockReturnValue(() => {})
vi.mock('@/core/session', () => ({
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  onAuthChange: (...a: unknown[]) => onAuthChange(...a),
  signOut: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/core/orgs', () => ({ fetchOrganizations: vi.fn() }))
vi.mock('@/core/billing', () => ({ fetchWalletBalance: vi.fn() }))
vi.mock('@/core/referral', () => ({
  fetchReferralCode: vi.fn().mockResolvedValue('ABC123'),
  fetchReferralUsageCount: vi.fn().mockResolvedValue(0),
}))
vi.mock('@/core/workspaces', () => ({
  fetchWorkspacesForOrgs: vi.fn().mockResolvedValue([]),
  createWorkspace: vi.fn(),
  createOrganization: vi.fn(),
}))
import { fetchOrganizations } from '@/core/orgs'
import { fetchWalletBalance } from '@/core/billing'
import { Rail } from '@/features/shell/screens/rail/Rail'

const t = en.rail
const MODE_LABELS = [t.mode.explorer, t.mode.files, t.mode.people, t.mode.history, t.mode.settings]

beforeEach(() => {
  useUiStore.setState({ activeMode: 'explorer' })
  getCurrentUser.mockReset().mockResolvedValue(makeUser())
  onAuthChange.mockReturnValue(() => {})
  vi.mocked(fetchOrganizations).mockResolvedValue([makeOrg({ name: 'Acme' })])
  vi.mocked(fetchWalletBalance).mockResolvedValue(120)
})

describe('Rail', () => {
  it('renders the primary navigation landmark', async () => {
    renderWithProviders(<Rail />)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('renders every mode entry plus marketplace and search', async () => {
    renderWithProviders(<Rail />)
    for (const label of [...MODE_LABELS, t.mode.marketplace, t.search]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('defaults to the explorer mode active', () => {
    renderWithProviders(<Rail />)
    expect(useUiStore.getState().activeMode).toBe('explorer')
  })

  it('switches the active mode when a mode entry is pressed', async () => {
    const { user } = renderWithProviders(<Rail />)
    await user.click(screen.getByRole('button', { name: t.mode.files }))
    await waitFor(() => expect(useUiStore.getState().activeMode).toBe('files'))
  })

  it('switches to marketplace when its entry is pressed', async () => {
    const { user } = renderWithProviders(<Rail />)
    await user.click(screen.getByRole('button', { name: t.mode.marketplace }))
    await waitFor(() => expect(useUiStore.getState().activeMode).toBe('marketplace'))
  })

  it('holds the readiness gate while the session is resolving', () => {
    getCurrentUser.mockReset().mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProviders(<Rail />)
    // Org-bound chrome renders as skeletons (labelled) while gated — not interactive.
    expect(screen.getByLabelText(t.org.loading)).toBeInTheDocument()
    expect(screen.getByLabelText(t.profile.label)).toBeInTheDocument() // profile skeleton
    expect(screen.queryByRole('button', { name: t.profile.label })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.invite.label })).toBeDisabled()
  })

  it('reveals the org switcher and profile once the session resolves', async () => {
    renderWithProviders(<Rail />)
    // Org resolved → the (workspace-aware) switcher button + the profile button render.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.org.switch })).toBeInTheDocument(),
    )
    expect(await screen.findByRole('button', { name: t.profile.label })).toBeInTheDocument()
  })

  it('shows the live credit balance after the org resolves', async () => {
    renderWithProviders(<Rail />)
    expect(await screen.findByRole('button', { name: `${t.credits.label}: 120` })).toBeInTheDocument()
  })

  it('keeps a large credit balance compact so the rail layout holds', async () => {
    vi.mocked(fetchWalletBalance).mockResolvedValue(1000)
    renderWithProviders(<Rail />)
    // The 56px rail must not be widened by a 4-digit balance — it renders as "1k".
    expect(await screen.findByText('1k')).toBeInTheDocument()
    expect(screen.queryByText('1000')).not.toBeInTheDocument()
    // Precise figure is still exposed to assistive tech.
    expect(screen.getByRole('button', { name: `${t.credits.label}: 1000` })).toBeInTheDocument()
  })

  it('keeps the active-mode marker on a single button at a time', async () => {
    const { user } = renderWithProviders(<Rail />)
    const explorerBtn = screen.getByRole('button', { name: t.mode.explorer })
    const filesBtn = screen.getByRole('button', { name: t.mode.files })
    const explorerActiveClass = explorerBtn.className

    await user.click(filesBtn)
    await waitFor(() => expect(useUiStore.getState().activeMode).toBe('files'))
    // Explorer is no longer active → its class signature changes; Files now carries the marker.
    expect(screen.getByRole('button', { name: t.mode.explorer }).className).not.toEqual(
      explorerActiveClass,
    )
  })

  it('enables the invite affordance once the session is ready', async () => {
    renderWithProviders(<Rail />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.invite.label })).toBeEnabled(),
    )
  })

  it('exposes the ⌘K search affordance with a Kbd hint in its tooltip', async () => {
    const { user } = renderWithProviders(<Rail />)
    const search = screen.getByRole('button', { name: t.search })
    expect(search).toBeEnabled() // search is never gated
    await user.hover(search)
    const tip = await screen.findByRole('tooltip')
    expect(within(tip).getByText('K')).toBeInTheDocument()
  })
})
