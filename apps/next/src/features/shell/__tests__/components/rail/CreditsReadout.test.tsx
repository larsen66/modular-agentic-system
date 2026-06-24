import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { en } from '@/features/shell/i18n/en'
import { CreditsReadout } from '@/features/shell/components/rail/CreditsReadout'
import { formatCredits } from '@/features/shell/hooks/useWalletBalance'

const t = en.rail.credits
const base = { orgName: 'Acme', onOpenBilling: () => {} }

describe('formatCredits (rail-safe compaction)', () => {
  it.each([
    [0, '0'],
    [5, '5'],
    [999, '999'],
    [1000, '1k'],
    [1500, '1.5k'],
    [1549, '1.5k'],
    [9999, '10k'],
    [12345, '12k'],
    [120000, '120k'],
    [999000, '999k'],
    [1_000_000, '1m'],
    [1_500_000, '1.5m'],
    [12_000_000, '12m'],
  ] as const)('formats %d → %s', (input, expected) => {
    expect(formatCredits(input)).toBe(expected)
  })

  it('never exceeds ~4 visible glyphs for any realistic balance (rail cannot widen)', () => {
    for (const n of [0, 42, 999, 1000, 9999, 12345, 120000, 999000, 5_000_000]) {
      expect(formatCredits(n).length).toBeLessThanOrEqual(4)
    }
  })

  it('is resilient to a non-finite balance', () => {
    expect(formatCredits(Number.NaN)).toBe('0')
    expect(formatCredits(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('CreditsReadout', () => {
  it('renders a skeleton when gated (disabled)', () => {
    renderWithProviders(
      <CreditsReadout balance={100} loading={false} disabled {...base} />,
    )
    expect(screen.getByLabelText(t.label)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a skeleton while first balance is loading', () => {
    renderWithProviders(
      <CreditsReadout balance={null} loading disabled={false} {...base} />,
    )
    expect(screen.getByLabelText(t.label)).toBeInTheDocument()
  })

  it('shows the live balance count on the trigger', () => {
    renderWithProviders(
      <CreditsReadout balance={42} loading={false} disabled={false} {...base} />,
    )
    expect(screen.getByRole('button', { name: `${t.label}: 42` })).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('treats a null balance (resolved, not loading) as zero', () => {
    renderWithProviders(
      <CreditsReadout balance={null} loading={false} disabled={false} {...base} />,
    )
    expect(screen.getByRole('button', { name: `${t.label}: 0` })).toBeInTheDocument()
  })

  it('compacts a large balance on the button so the rail does not break', () => {
    renderWithProviders(
      <CreditsReadout balance={1000} loading={false} disabled={false} {...base} />,
    )
    // Visible button text is compacted ("1k"), not the raw "1000" that overflowed the 56px rail.
    expect(screen.getByText('1k')).toBeInTheDocument()
    expect(screen.queryByText('1000')).not.toBeInTheDocument()
    // …but the accessible name keeps the precise figure.
    expect(screen.getByRole('button', { name: `${t.label}: 1000` })).toBeInTheDocument()
  })

  it('shows the precise balance inside the (wide) popover even when compacted on the rail', async () => {
    const { user } = renderWithProviders(
      <CreditsReadout balance={12345} loading={false} disabled={false} {...base} />,
    )
    // Button is compacted…
    expect(screen.getByText('12k')).toBeInTheDocument()
    // …popover chip is exact.
    await user.click(screen.getByRole('button', { name: `${t.label}: 12345` }))
    expect(await screen.findByText(`12345 ${t.unitMany}`)).toBeInTheDocument()
  })

  it('opens the billing popover with USD, credits chip, org name and actions', async () => {
    const { user } = renderWithProviders(
      <CreditsReadout balance={250} loading={false} disabled={false} {...base} />,
    )
    await user.click(screen.getByRole('button', { name: `${t.label}: 250` }))

    // 250 credits × $0.01 = $2.50
    expect(await screen.findByTestId('credits-popup-balance-usd')).toHaveTextContent('$2.50')
    expect(screen.getByText(`250 ${t.unitMany}`)).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByTestId('credits-popup-buy-credits')).toBeInTheDocument()
    expect(screen.getByTestId('credits-popup-upgrade-plan')).toBeInTheDocument()
    expect(screen.getByTestId('credits-popup-view-usage-link')).toBeInTheDocument()
  })

  it('uses the singular credit unit for a balance of 1', async () => {
    const { user } = renderWithProviders(
      <CreditsReadout balance={1} loading={false} disabled={false} {...base} />,
    )
    await user.click(screen.getByRole('button', { name: `${t.label}: 1` }))
    expect(await screen.findByText(`1 ${t.unitOne}`)).toBeInTheDocument()
  })

  it('formats a sub-cent balance with 4 decimals', async () => {
    const { user } = renderWithProviders(
      <CreditsReadout balance={0} loading={false} disabled={false} {...base} />,
    )
    await user.click(screen.getByRole('button', { name: `${t.label}: 0` }))
    expect(await screen.findByTestId('credits-popup-balance-usd')).toHaveTextContent('$0.0000')
  })

  it.each([
    ['credits-popup-buy-credits', 'buy'],
    ['credits-popup-upgrade-plan', 'plans'],
    ['credits-popup-view-usage-link', 'usage'],
  ] as const)('routes %s to onOpenBilling("%s")', async (testid, target) => {
    const onOpenBilling = vi.fn()
    const { user } = renderWithProviders(
      <CreditsReadout balance={50} loading={false} disabled={false} orgName="Acme" onOpenBilling={onOpenBilling} />,
    )
    await user.click(screen.getByRole('button', { name: `${t.label}: 50` }))
    await user.click(await screen.findByTestId(testid))
    expect(onOpenBilling).toHaveBeenCalledWith(target)
  })

  it('omits the org line when no org name is given', async () => {
    const { user } = renderWithProviders(
      <CreditsReadout balance={50} loading={false} disabled={false} orgName={null} onOpenBilling={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: `${t.label}: 50` }))
    await screen.findByTestId('credits-popup-balance-usd')
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })
})
