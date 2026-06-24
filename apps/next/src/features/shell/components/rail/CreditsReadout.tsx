import { Button, Chip, Popover, Skeleton } from '@heroui/react'
import { Zap } from 'lucide-react'
import { creditTone, formatCredits } from '../../hooks/useWalletBalance'
import { useShellStrings } from '../../i18n'
import type { CreditTone, CreditsReadoutProps } from '../../types'

// Credit readout + Credits & Billing popover. Capability parity with legacy CreditsPopup (balance,
// credits, org, Billing actions) — presentation is native HeroUI (Popover.Dialog + Chip + Button
// variants + semantic tokens). NO custom CSS: the only classes are structural layout utilities.
// CREDIT_FACE_VALUE_USD = 0.01 → USD = credits × 0.01.
const CREDIT_FACE_VALUE_USD = 0.01

// Balance state → a HeroUI Chip color (semantic token); healthy balance shows no chip (calm).
const TONE_COLOR: Record<CreditTone, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  warning: 'warning',
  danger: 'danger',
}

function formatUsd(balance: number | null | undefined): string {
  if (balance == null) return '—'
  const usd = balance * CREDIT_FACE_VALUE_USD
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`
}

export function CreditsReadout({
  balance,
  loading,
  disabled,
  orgName,
  onOpenBilling,
}: CreditsReadoutProps) {
  const t = useShellStrings()

  if (disabled || (loading && balance == null)) {
    return <Skeleton className="size-9 rounded-large" aria-label={t.rail.credits.label} />
  }

  const credits = balance ?? 0
  const tone = creditTone(balance)

  return (
    <Popover>
      <Popover.Trigger aria-label={`${t.rail.credits.label}: ${credits}`}>
        <Button isIconOnly variant="ghost" size="md" className="h-auto py-2">
          <div className="flex flex-col items-center gap-0.5">
            <Zap className="shrink-0 size-3.5 text-accent fill-accent" />
            <span className="truncate tabular-nums text-xs">{formatCredits(credits)}</span>
          </div>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-72" placement="right bottom" shouldFlip={false} offset={13}>
        <Popover.Dialog>
          <div className="flex flex-col gap-3">
            <Popover.Heading>{t.rail.credits.title}</Popover.Heading>

            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums" data-testid="credits-popup-balance-usd">
                {formatUsd(balance)}
              </span>
              <Chip color={TONE_COLOR[tone]} size="sm" variant="soft">
                {credits} {credits === 1 ? t.rail.credits.unitOne : t.rail.credits.unitMany}
              </Chip>
            </div>
            {orgName && <p className="text-sm text-muted">{orgName}</p>}

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1"
                  data-testid="credits-popup-buy-credits"
                  onPress={() => onOpenBilling('buy')}
                >
                  {t.rail.credits.buy}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  data-testid="credits-popup-upgrade-plan"
                  onPress={() => onOpenBilling('plans')}
                >
                  {t.rail.credits.upgrade}
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                data-testid="credits-popup-view-usage-link"
                onPress={() => onOpenBilling('usage')}
              >
                {t.rail.credits.viewUsage}
              </Button>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
