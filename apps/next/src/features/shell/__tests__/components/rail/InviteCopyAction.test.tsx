import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { makeOrg, makeUser } from '@/test/factories'
import { en } from '@/features/shell/i18n/en'

vi.mock('@/core/referral', () => ({
  fetchReferralCode: vi.fn().mockResolvedValue('ABC123'),
  fetchReferralUsageCount: vi.fn().mockResolvedValue(0),
}))
import { InviteCopyAction } from '@/features/shell/components/rail/InviteCopyAction'

const t = en.rail.profile
const user = makeUser()
const org = makeOrg()

describe('InviteCopyAction', () => {
  it('renders the invite-and-earn row with its hint', async () => {
    renderWithProviders(<InviteCopyAction user={user} currentOrg={org} />)
    expect(await screen.findByText(t.inviteEarn)).toBeInTheDocument()
    expect(screen.getByText(t.inviteHint)).toBeInTheDocument()
  })

  it('is disabled until the referral link resolves', () => {
    // Before the query resolves the button has no link → disabled.
    renderWithProviders(<InviteCopyAction user={user} currentOrg={org} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('copies the link and shows the confirmation popover once resolved', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { user: ux } = renderWithProviders(<InviteCopyAction user={user} currentOrg={org} />)

    // Wait for the link to resolve → button enabled.
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
    await ux.click(screen.getByRole('button'))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=ABC123'))
    expect(await screen.findByText(t.linkCopied)).toBeInTheDocument()
  })
})
