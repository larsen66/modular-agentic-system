import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { en } from '@/features/shell/i18n/en'
import { ReferralLink } from '@/features/shell/components/rail/ReferralLink'

const t = en.rail.referral
const LINK = 'https://bos.pro/?ref=ABC123'

describe('ReferralLink', () => {
  it('shows the link in a read-only field', () => {
    renderWithProviders(<ReferralLink link={LINK} loading={false} />)
    const input = screen.getByRole('textbox', { name: t.linkLabel }) as HTMLInputElement
    expect(input).toHaveValue(LINK)
    expect(input).toHaveAttribute('readonly')
  })

  it('shows the loading placeholder while generating', () => {
    renderWithProviders(<ReferralLink link={null} loading />)
    expect(screen.getByRole('textbox', { name: t.linkLabel })).toHaveValue(t.loading)
  })

  it('shows the unavailable hint when there is no link and not loading', () => {
    renderWithProviders(<ReferralLink link={null} loading={false} />)
    expect(screen.getByRole('textbox', { name: t.linkLabel })).toHaveValue(t.unavailable)
  })

  it('disables Copy when there is no link', () => {
    renderWithProviders(<ReferralLink link={null} loading={false} />)
    expect(screen.getByRole('button', { name: t.copy })).toBeDisabled()
  })

  it('copies the link and flips the button label to Copied', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { user } = renderWithProviders(<ReferralLink link={LINK} loading={false} />)

    await user.click(screen.getByRole('button', { name: t.copy }))
    expect(writeText).toHaveBeenCalledWith(LINK)
    await waitFor(() => expect(screen.getByRole('button', { name: t.copied })).toBeInTheDocument())
  })
})
