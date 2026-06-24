import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeUser } from '@/test/factories'
import { useUiStore } from '@/state/uiStore'
import { en } from '@/features/shell/i18n/en'
import { de } from '@/features/shell/i18n/de'

vi.mock('@/core/session', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  onAuthChange: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('@/core/referral', () => ({
  fetchReferralCode: vi.fn().mockResolvedValue('ABC123'),
  fetchReferralUsageCount: vi.fn().mockResolvedValue(0),
}))
import { signOut } from '@/core/session'
import { ProfileMenu } from '@/features/shell/components/rail/ProfileMenu'

const t = en.rail.profile
const user = makeUser({ user_metadata: { full_name: 'Ada Lovelace' }, email: 'ada@example.com' })
const org = makeOrg({ name: 'Acme' })

// uiStore is a module singleton — reset theme/language to defaults before each test.
beforeEach(() => {
  useUiStore.setState({ theme: 'system', language: 'en' })
})

function openMenu(balance: number | null = 100) {
  return renderWithProviders(
    <ProfileMenu user={user} currentOrg={org} balance={balance} loading={false} disabled={false} />,
  )
}

describe('ProfileMenu', () => {
  it('renders a skeleton while loading', () => {
    renderWithProviders(
      <ProfileMenu user={null} currentOrg={null} balance={null} loading disabled={false} />,
    )
    expect(screen.getByLabelText(t.label)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.label })).not.toBeInTheDocument()
  })

  it('renders a skeleton when gated (disabled)', () => {
    renderWithProviders(
      <ProfileMenu user={user} currentOrg={org} balance={100} loading={false} disabled />,
    )
    expect(screen.getByLabelText(t.label)).toBeInTheDocument()
  })

  it('shows the trigger with the account aria-label', () => {
    openMenu()
    expect(screen.getByRole('button', { name: t.label })).toBeInTheDocument()
  })

  it('opens the identity block with name and email', async () => {
    const { user: ux } = openMenu()
    await ux.click(screen.getByRole('button', { name: t.label }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('shows the current org row with its balance chip', async () => {
    const { user: ux } = openMenu(250)
    await ux.click(screen.getByRole('button', { name: t.label }))
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('omits the org row when there is no current org', async () => {
    const { user: ux } = renderWithProviders(
      <ProfileMenu user={user} currentOrg={null} balance={10} loading={false} disabled={false} />,
    )
    await ux.click(screen.getByRole('button', { name: t.label }))
    await screen.findByText('Ada Lovelace')
    expect(screen.queryByText(t.currentOrg)).not.toBeInTheDocument()
  })

  it('changes the theme through the toggle group', async () => {
    const { user: ux } = openMenu()
    await ux.click(screen.getByRole('button', { name: t.label }))
    await ux.click(await screen.findByRole('radio', { name: t.themeDark }))
    await waitFor(() => expect(useUiStore.getState().theme).toBe('dark'))
  })

  it('changes the language through the select', async () => {
    const { user: ux } = openMenu()
    await ux.click(screen.getByRole('button', { name: t.label }))
    await screen.findByText('Ada Lovelace') // let the popover settle before reaching inside
    // The Select trigger's accessible name is the value + the aria-label ("English Language").
    await ux.click(screen.getByRole('button', { name: new RegExp(t.language) }))
    await ux.click(await screen.findByRole('option', { name: 'Deutsch' }))
    await waitFor(() => expect(useUiStore.getState().language).toBe('de'))
  })

  it('copies the invite link from the profile menu invite row and confirms', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { user: ux } = openMenu()
    await ux.click(screen.getByRole('button', { name: t.label }))
    await screen.findByText('Ada Lovelace') // popover settled

    // The "Invite & earn" row is disabled until its referral link resolves.
    const inviteRow = screen.getByRole('button', { name: new RegExp(t.inviteEarn) })
    await waitFor(() => expect(inviteRow).toBeEnabled())
    await ux.click(inviteRow)

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=ABC123'))
    expect(await screen.findByText(t.linkCopied)).toBeInTheDocument()
  })

  it('signs out when the sign-out action is pressed', async () => {
    const { user: ux } = openMenu()
    await ux.click(screen.getByRole('button', { name: t.label }))
    await ux.click(await screen.findByRole('button', { name: new RegExp(t.signOut) }))
    expect(vi.mocked(signOut)).toHaveBeenCalledTimes(1)
  })

  it('localizes the menu when the active language is German', async () => {
    useUiStore.setState({ language: 'de' })
    const { user: ux } = renderWithProviders(
      <ProfileMenu user={user} currentOrg={org} balance={100} loading={false} disabled={false} />,
    )
    await ux.click(screen.getByRole('button', { name: de.rail.profile.label }))
    // German sign-out label proves the i18n wiring flows through the store.
    expect(await screen.findByText(de.rail.profile.signOut)).toBeInTheDocument()
  })
})
