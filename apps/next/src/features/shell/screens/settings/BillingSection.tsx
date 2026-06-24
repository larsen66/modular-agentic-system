import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Chip, Label, ListBox, Meter, Select, Skeleton, Spinner,
  Tabs,
} from '@heroui/react'
import { Coins, CreditCard, ExternalLink, Wallet } from 'lucide-react'
import {
  CREDIT_PACKAGES, SUBSCRIPTION_PLANS, CREDIT_FACE_VALUE_USD,
  type CreditPackage, type SubscriptionPlan, type CreditOption,
} from '@shared/billing/catalog'
import {
  createCreditCheckout, createSubscriptionCheckout, verifyCreditPurchase,
  openCustomerPortal, fetchActiveSubscription, SubscriptionCheckoutError,
} from '@/core/billing'
import { useWalletBalance, creditTone, formatCredits } from '../../hooks/useWalletBalance'
import { UsageBreakdownCard } from './UsageBreakdownCard'

// Org billing — the reinvented single-page surface (design: docs/design/settings/screens/org-billing.md,
// Variant B). Capability parity with the legacy 6-tab BillingSection, NOT a markup port: a Meter-driven
// balance gauge, motion Tabs, and a HeroUI pricing grid instead of `?billing_tab=` tabs. All backend
// access goes through `core/billing.ts` (the real live Stripe edge functions); the catalog
// (`@shared/billing/catalog.ts`) is the pricing authority. Cards by operator urgency:
// Credit balance → Buy → Current plan → Manage billing.

type Motion = 'oneTime' | 'subscribe'

// Healthy-runway ceiling for the balance gauge. The Meter caps its fill here so a comfortable
// balance reads "full"; tone (danger <5 / warning <20) drives the colour regardless of the cap.
const RUNWAY_TARGET = 100

const ORIGIN = (): string => window.location.origin

/** USD-equivalent of a credit balance (1 credit = CREDIT_FACE_VALUE_USD). */
function usd(credits: number): string {
  const v = credits * CREDIT_FACE_VALUE_USD
  return v >= 0.01 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`
}

const TONE_COLOR = { danger: 'danger', warning: 'warning', ok: 'success' } as const

export function BillingSection({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const wallet = useWalletBalance(orgId)
  const { data: subscription } = useQuery({
    queryKey: ['billing', 'activeSubscription', orgId],
    queryFn: () => fetchActiveSubscription(orgId),
    staleTime: 30_000,
  })

  // Post-Stripe return handling (fail-closed, legacy PB121). Verify before celebrating; strip the
  // params immediately so a refresh can't re-fire; refetch the wallet so the new balance shows.
  const [returnNotice, setReturnNotice] = useState<{ status: 'success' | 'danger'; text: string } | null>(null)
  useEffect(() => {
    const purchased = searchParams.get('credits_purchased') === 'true'
    const subscribed = searchParams.get('subscribed') === 'true'
    if (!purchased && !subscribed) return

    const sessionId = searchParams.get('stripe_session_id') ?? ''
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('credits_purchased')
        next.delete('subscribed')
        next.delete('stripe_session_id')
        return next
      },
      { replace: true },
    )

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shell', 'walletBalance', orgId] })

    if (subscribed) {
      setReturnNotice({ status: 'success', text: 'Subscription active — your credits will refill automatically each month.' })
      invalidate()
      return
    }
    if (!sessionId) return
    void (async () => {
      const ok = await verifyCreditPurchase(sessionId)
      if (ok) {
        setReturnNotice({ status: 'success', text: 'Payment confirmed — credits added to your wallet.' })
        invalidate()
      } else {
        setReturnNotice({ status: 'danger', text: "We couldn't confirm your payment yet. If you completed checkout, your balance will update shortly." })
      }
    })()
    // Run once on mount for the return params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Usage &amp; billing</h1>
        <p className="text-sm text-muted">Credits, usage, plans, and payment for your organization.</p>
      </div>

      {returnNotice && (
        <Alert status={returnNotice.status}>
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{returnNotice.text}</Alert.Description></Alert.Content>
        </Alert>
      )}

      <CreditBalanceCard balance={wallet.data} loading={wallet.isLoading} error={Boolean(wallet.error)} />
      <UsageBreakdownCard orgId={orgId} />
      <BuyCard orgId={orgId} activePlanId={subscription?.planId ?? null} />
      <CurrentPlanCard planId={subscription?.planId ?? null} />
      <ManageBillingCard orgId={orgId} />
    </div>
  )
}

// ─── Credit balance ─────────────────────────────────────────────────────────────

function CreditBalanceCard({
  balance,
  loading,
  error,
}: {
  balance: number | undefined
  loading: boolean
  error: boolean
}) {
  const tone = creditTone(balance)
  const value = Math.min(balance ?? 0, RUNWAY_TARGET)

  return (
    <Card variant="secondary">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Wallet aria-hidden className="size-4 text-muted" />
          <Card.Title>Credit balance</Card.Title>
        </div>
        <Card.Description>
          Your organization shares one wallet. Runs spend credits — planning and protected retries are free.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ) : error ? (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>Balance unavailable right now.</Alert.Description></Alert.Content>
          </Alert>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-foreground">{formatCredits(balance ?? 0)}</span>
                <span className="text-sm text-muted">credits · {usd(balance ?? 0)}</span>
              </div>
              {tone === 'danger' && <Chip color="danger" variant="soft">Out of credits soon</Chip>}
              {tone === 'warning' && <Chip color="warning" variant="soft">Running low</Chip>}
              {tone === 'ok' && <Chip color="success" variant="soft">Healthy</Chip>}
            </div>
            <Meter
              aria-label="Credit balance"
              value={value}
              minValue={0}
              maxValue={RUNWAY_TARGET}
              color={TONE_COLOR[tone]}
            >
              <Meter.Track><Meter.Fill /></Meter.Track>
            </Meter>
          </>
        )}
      </Card.Content>
    </Card>
  )
}

// ─── Buy (one-time packs + subscription plans, catalog-driven) ───────────────────

function BuyCard({ orgId, activePlanId }: { orgId: string; activePlanId: string | null }) {
  const [motion, setMotion] = useState<Motion>('oneTime')
  const [busyTierId, setBusyTierId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleBuy = async (tierId: string, credits: number) => {
    setError(null)
    setBusyTierId(tierId)
    try {
      if (motion === 'oneTime') {
        const url = await createCreditCheckout({
          orgId,
          packageId: tierId,
          credits,
          returnUrl: `${ORIGIN()}/settings/org?section=billing&credits_purchased=true&stripe_session_id={CHECKOUT_SESSION_ID}`,
        })
        window.location.href = url
      } else {
        const url = await createSubscriptionCheckout({
          orgId,
          planId: tierId,
          bucketId: `${tierId}-${credits}`,
          returnUrl: `${ORIGIN()}/settings/org?section=billing&subscribed=true`,
        })
        window.location.href = url
      }
    } catch (e) {
      if (e instanceof SubscriptionCheckoutError && e.code === 'subscription_price_unconfigured') {
        setError('Subscriptions aren’t available for this plan yet — try a one-time pack.')
      } else {
        setError('Checkout couldn’t start. Please try again.')
      }
      setBusyTierId(null)
    }
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Coins aria-hidden className="size-4 text-muted" />
          <Card.Title>Get more credits</Card.Title>
        </div>
        <Card.Description>Buy a one-time pack, or subscribe for automatic monthly refills. Paid credits never expire.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {error && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}
        <Tabs
          selectedKey={motion}
          onSelectionChange={(k) => { setMotion(k as Motion); setError(null) }}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Purchase type">
              <Tabs.Tab id="oneTime">One-time<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="subscribe">Subscribe<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="oneTime">
            <TierGrid
              motion="oneTime"
              tiers={CREDIT_PACKAGES}
              activePlanId={activePlanId}
              busyTierId={busyTierId}
              onBuy={handleBuy}
            />
          </Tabs.Panel>
          <Tabs.Panel id="subscribe">
            <TierGrid
              motion="subscribe"
              tiers={SUBSCRIPTION_PLANS}
              activePlanId={activePlanId}
              busyTierId={busyTierId}
              onBuy={handleBuy}
            />
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </Card>
  )
}

function TierGrid({
  motion,
  tiers,
  activePlanId,
  busyTierId,
  onBuy,
}: {
  motion: Motion
  tiers: readonly (CreditPackage | SubscriptionPlan)[]
  activePlanId: string | null
  busyTierId: string | null
  onBuy: (tierId: string, credits: number) => void | Promise<void>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
      {tiers.map((tier) => (
        <TierCard
          key={`${motion}-${tier.id}`}
          motion={motion}
          tier={tier}
          isCurrent={motion === 'subscribe' && activePlanId === tier.id}
          busy={busyTierId === tier.id}
          disabledAll={busyTierId !== null}
          onBuy={(credits) => onBuy(tier.id, credits)}
        />
      ))}
    </div>
  )
}

/** One catalog tier as a pricing card: name + badges, live price, credit-amount selector, buy CTA. */
function TierCard({
  motion,
  tier,
  isCurrent,
  busy,
  disabledAll,
  onBuy,
}: {
  motion: Motion
  tier: CreditPackage | SubscriptionPlan
  isCurrent: boolean
  busy: boolean
  disabledAll: boolean
  onBuy: (credits: number) => void | Promise<void>
}) {
  // Selectable buckets: one-time shows all options; subscribe shows only subscription-eligible ones.
  const options: CreditOption[] = useMemo(() => {
    const all = tier.creditOptions ?? []
    return motion === 'subscribe' ? all.filter((o) => o.subscription_eligible === true) : all
  }, [tier, motion])

  const defaultCredits = motion === 'oneTime'
    ? (tier as CreditPackage).credits
    : (tier as SubscriptionPlan).creditsPerMonth
  const initial = options.find((o) => o.credits === defaultCredits)?.credits ?? options[0]?.credits ?? defaultCredits
  const [credits, setCredits] = useState<number>(initial)

  const selected = options.find((o) => o.credits === credits)
  const priceLabel = selected?.priceLabel ?? tier.priceLabel
  const noOptions = options.length === 0

  return (
    <Card variant={tier.popular ? 'tertiary' : 'default'} className="h-full">
      <Card.Header className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <Card.Title>{tier.name}</Card.Title>
          {isCurrent ? (
            <Chip size="sm" color="success" variant="soft">Current</Chip>
          ) : tier.popular ? (
            <Chip size="sm" color="accent" variant="soft">Popular</Chip>
          ) : null}
        </div>
        <Card.Description>{tier.description}</Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-1 flex-col gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-foreground">{priceLabel}</span>
          {motion === 'subscribe' && <span className="text-sm text-muted">/mo</span>}
        </div>
        <span className="text-xs text-muted">{(selected?.credits ?? defaultCredits).toLocaleString()} credits · {tier.perCredit}</span>
        {noOptions ? (
          <span className="text-xs text-muted">Not available yet</span>
        ) : (
          <Select
            aria-label={`${tier.name} credit amount`}
            selectedKey={String(credits)}
            onSelectionChange={(k) => setCredits(Number(k))}
            isDisabled={disabledAll}
          >
            <Label className="sr-only">Credit amount</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {options.map((o) => (
                  <ListBox.Item key={o.credits} id={String(o.credits)} textValue={`${o.credits} credits — ${o.priceLabel}`}>
                    {o.credits.toLocaleString()} credits — {o.priceLabel}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
      </Card.Content>

      <Card.Footer>
        <Button
          fullWidth
          variant={tier.popular ? 'primary' : 'secondary'}
          isDisabled={disabledAll || noOptions}
          onPress={() => void onBuy(credits)}
        >
          {busy ? <Spinner size="sm" /> : motion === 'oneTime' ? `Buy ${priceLabel}` : `Subscribe · ${priceLabel}/mo`}
        </Button>
      </Card.Footer>
    </Card>
  )
}

// ─── Current plan ────────────────────────────────────────────────────────────────

function CurrentPlanCard({ planId }: { planId: string | null }) {
  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  return (
    <Card>
      <Card.Header>
        <Card.Title>Current plan</Card.Title>
        <Card.Description>
          {plan
            ? 'Your monthly subscription. Manage or cancel it in the billing portal below.'
            : 'You’re on pay-as-you-go — buy packs as needed, or subscribe above for automatic monthly refills.'}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {plan ? (
          <div className="flex items-center gap-3">
            <Chip color="accent" variant="soft">{plan.name}</Chip>
            <span className="text-sm text-muted">{plan.creditsPerMonth.toLocaleString()} credits / month</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Coins aria-hidden className="size-4" /> No active subscription
          </div>
        )}
      </Card.Content>
    </Card>
  )
}

// ─── Manage billing (Stripe customer portal — payment methods + invoices) ────────

function ManageBillingCard({ orgId }: { orgId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <Card.Header>
        <Card.Title>Payment & invoices</Card.Title>
        <Card.Description>Manage saved cards, billing details, and past invoices in Stripe’s secure portal.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {error && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}
      </Card.Content>
      <Card.Footer>
        <Button
          variant="outline"
          isDisabled={busy}
          onPress={async () => {
            setError(null)
            setBusy(true)
            try {
              const url = await openCustomerPortal({ orgId, returnUrl: window.location.href })
              window.location.href = url
            } catch {
              setError('Couldn’t open the billing portal. Please try again.')
              setBusy(false)
            }
          }}
        >
          {busy ? <Spinner size="sm" /> : <CreditCard className="size-4" />}
          Manage billing
          <ExternalLink className="size-3.5" />
        </Button>
      </Card.Footer>
    </Card>
  )
}
