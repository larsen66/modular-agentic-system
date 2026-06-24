import { Button } from '@heroui/react'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeUser } from '@/test/factories'
import { en } from '@/features/shell/i18n/en'

vi.mock('@/core/referral', () => ({
  fetchReferralCode: vi.fn().mockResolvedValue('ABC123'),
  fetchReferralUsageCount: vi.fn().mockResolvedValue(0),
}))
import { fetchReferralUsageCount } from '@/core/referral'
import { InviteModal } from '@/features/shell/components/rail/InviteModal'

const t = en.rail.invite
const user = makeUser()
const org = makeOrg()

afterEach(() => vi.mocked(fetchReferralUsageCount).mockResolvedValue(0))

describe('InviteModal', () => {
  it('renders the default Gift trigger with the invite aria-label', () => {
    renderWithProviders(<InviteModal user={user} currentOrg={org} />)
    expect(screen.getByRole('button', { name: t.label })).toBeInTheDocument()
  })

  it('disables the default trigger when gated', () => {
    renderWithProviders(<InviteModal user={user} currentOrg={org} disabled />)
    expect(screen.getByRole('button', { name: t.label })).toBeDisabled()
  })

  it('opens the modal with title, subtitle and all invite steps', async () => {
    const { user: ux } = renderWithProviders(<InviteModal user={user} currentOrg={org} />)
    await ux.click(screen.getByRole('button', { name: t.label }))

    expect(await screen.findByText(t.title)).toBeInTheDocument()
    expect(screen.getByText(t.subtitle)).toBeInTheDocument()
    for (const step of t.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument()
      expect(screen.getByText(step.desc)).toBeInTheDocument()
    }
  })

  it('shows the resolved referral link inside the modal', async () => {
    const { user: ux } = renderWithProviders(<InviteModal user={user} currentOrg={org} />)
    await ux.click(screen.getByRole('button', { name: t.label }))

    const field = (await screen.findByRole('textbox', {
      name: en.rail.referral.linkLabel,
    })) as HTMLInputElement
    expect(field.value).toContain('ref=ABC123')
  })

  it('shows the usage count line when referrals have been used', async () => {
    vi.mocked(fetchReferralUsageCount).mockResolvedValue(3)
    const { user: ux } = renderWithProviders(<InviteModal user={user} currentOrg={org} />)
    await ux.click(screen.getByRole('button', { name: t.label }))
    expect(await screen.findByText(`3 ${en.rail.referral.usedBy}`)).toBeInTheDocument()
  })

  it('accepts a custom trigger in place of the default Gift button', () => {
    renderWithProviders(
      <InviteModal user={user} currentOrg={org} trigger={<Button>Open invite</Button>} />,
    )
    expect(screen.getByRole('button', { name: 'Open invite' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.label })).not.toBeInTheDocument()
  })
})
