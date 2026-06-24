import { supabase } from './supabase'

// Billing access seam. The spendable wallet balance is the canonical credit readout used by the
// Rail (passive) and, later, the Billing area (top-up action). Single canonical reader — the RPC
// `get_org_credit_balance` returns an integer floored at 0 (legacy invariant BE04). Don't query
// the credit ledger tables directly elsewhere; go through this op.

/**
 * The org's spendable credit balance (integer, floored at 0).
 * `null`-org callers should not invoke this — guard with `enabled: Boolean(orgId)` upstream.
 */
export async function fetchWalletBalance(orgId: string): Promise<number> {
  // codegen widens RPC args to `Record<string, never>`; assert through `as never` (known
  // supabase-js limitation, not a real type hole — see legacy useWalletBalance.ts).
  const { data, error } = await supabase.rpc(
    'get_org_credit_balance' as never,
    { p_org_id: orgId } as never,
  )
  if (error) throw new Error(`get_org_credit_balance failed: ${error.message}`)
  return typeof data === 'number' ? data : 0
}

// ─── Purchase flows ────────────────────────────────────────────────────────────
//
// The island reuses the SAME live Stripe edge functions as legacy (stripe-checkout,
// stripe-create-subscription, verify-credit-purchase, stripe-customer-portal). These are thin
// `functions.invoke` wrappers — the request/response shapes are the backend contract and must
// match legacy verbatim (src/hooks/billing/*, src/pages/Plans.tsx, src/pages/OrgSettings/BillingSection.tsx).
// No Stripe SDK in the frontend; the org id is always passed verbatim by the caller (the
// authoritative active org), never read from localStorage here — that wrong-org-charge guard is
// the caller's job.

/** Args for a one-time credit-pack checkout. */
export interface CreditCheckoutArgs {
  /** Active org id (authoritative — passed verbatim into the Stripe session). */
  orgId: string
  /** Catalog package id (e.g. "starter" | "growth" | "pro"). */
  packageId: string
  /** Selected credit amount within the package's `creditOptions`. */
  credits?: number
  /** Absolute Stripe return URL (carries `?section=billing&credits_purchased=true&stripe_session_id={CHECKOUT_SESSION_ID}`). */
  returnUrl: string
}

/**
 * Create a one-time credit-pack Stripe Checkout session and return its hosted URL.
 * Throws on invoke failure or a missing `checkout_url` — the caller surfaces the error and,
 * on success, sets `window.location.href` to the returned URL.
 */
export async function createCreditCheckout(args: CreditCheckoutArgs): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      org_id: args.orgId,
      package_id: args.packageId,
      credits: args.credits,
      return_url: args.returnUrl,
    },
  })
  if (error) throw new Error('checkout_failed')
  const url = (data as { checkout_url?: string } | null)?.checkout_url
  if (!url) throw new Error('no_checkout_url')
  return url
}

/** Stable error vocabulary for subscription checkout (parity with legacy useSubscriptionCheckout). */
export type SubscriptionCheckoutErrorCode =
  | 'subscription_price_unconfigured'
  | 'checkout_failed'
  | 'no_checkout_url'

/** Typed error so the UI can render "subscription not available yet" vs a generic failure. */
export class SubscriptionCheckoutError extends Error {
  readonly code: SubscriptionCheckoutErrorCode
  constructor(code: SubscriptionCheckoutErrorCode) {
    super(code)
    this.code = code
    this.name = 'SubscriptionCheckoutError'
  }
}

/** Args for a recurring auto-refill subscription checkout. */
export interface SubscriptionCheckoutArgs {
  /** Active org id (authoritative — passed verbatim). */
  orgId: string
  /** Catalog subscription plan id (e.g. "starter" | "growth" | "pro"). */
  planId: string
  /** Catalog bucket SLUG of form `<plan>-<credits>` (e.g. "growth-500") — the wire format the edge fn validates. */
  bucketId: string
  /** Absolute Stripe return URL (carries `?section=billing&subscribed=true`). */
  returnUrl: string
}

/** Edge `error_code`s (and the legacy flag-off plaintext body) meaning the recurring Price is not configured. */
const UNCONFIGURED_PRICE_CODES = new Set<string>([
  'subscription_price_unconfigured',
  'bucket_id_not_found',
  'bucket_id_required',
  'bucket_id_invalid',
])

/**
 * Best-effort extraction of `{ error, error_code }` from a failed `functions.invoke`.
 * Supabase's `FunctionsHttpError` carries the raw `Response` on `.context`; non-2xx bodies are not
 * surfaced on `data`, so we read the body defensively (mirrors legacy `readEdgeError`).
 */
async function readEdgeError(invokeError: unknown): Promise<{ error?: string; error_code?: string }> {
  const ctx = (invokeError as { context?: unknown } | null)?.context
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = (await (ctx as Response).json()) as { error?: string; error_code?: string }
      return { error: body?.error, error_code: body?.error_code }
    } catch {
      return {}
    }
  }
  return {}
}

function isUnconfiguredPrice(edge: { error?: string; error_code?: string }): boolean {
  if (edge.error_code && UNCONFIGURED_PRICE_CODES.has(edge.error_code)) return true
  const msg = (edge.error ?? '').toLowerCase()
  return msg.includes('price id not configured') || msg.includes('not configured for')
}

/**
 * Create a recurring-subscription Stripe Checkout session and return its hosted URL.
 * Throws a {@link SubscriptionCheckoutError} classified as `subscription_price_unconfigured` when no
 * recurring Price resolves (so the panel shows "not available yet"), else `checkout_failed` /
 * `no_checkout_url`. Mirrors legacy `useSubscriptionCheckout` classification exactly.
 */
export async function createSubscriptionCheckout(args: SubscriptionCheckoutArgs): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-create-subscription', {
    body: {
      org_id: args.orgId,
      plan_id: args.planId,
      bucket_id: args.bucketId,
      return_url: args.returnUrl,
    },
  })

  if (error) {
    const edge = await readEdgeError(error)
    throw new SubscriptionCheckoutError(isUnconfiguredPrice(edge) ? 'subscription_price_unconfigured' : 'checkout_failed')
  }

  // Defensive: a 2xx with a typed-error body (the edge fn returns non-2xx for these, but a future
  // wiring change must not crash the UI).
  const response = data as { checkout_url?: string; error?: string; error_code?: string } | null
  if (response?.error_code || response?.error) {
    throw new SubscriptionCheckoutError(isUnconfiguredPrice(response) ? 'subscription_price_unconfigured' : 'checkout_failed')
  }
  if (!response?.checkout_url) throw new SubscriptionCheckoutError('no_checkout_url')
  return response.checkout_url
}

/**
 * Verify a completed Stripe checkout by session id. Returns `true` only when the edge function
 * confirms `{ verified: true }` (fail-closed — used to gate the post-purchase success message).
 * Never throws: a network/edge failure resolves to `false`.
 */
export async function verifyCreditPurchase(stripeSessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ verified: boolean }>('verify-credit-purchase', {
      body: { stripe_session_id: stripeSessionId },
    })
    return !error && data?.verified === true
  } catch {
    return false
  }
}

/**
 * Open the Stripe Customer Portal (manage saved cards / payment methods) and return its URL.
 * Throws on invoke failure or a missing `portal_url`; the caller redirects via `window.location.href`.
 */
export async function openCustomerPortal(opts: { orgId: string; returnUrl: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
    body: { org_id: opts.orgId, return_url: opts.returnUrl },
  })
  if (error) throw new Error('portal_failed')
  const url = (data as { portal_url?: string } | null)?.portal_url
  if (!url) throw new Error('no_portal_url')
  return url
}

/** The org's active subscription (for the decorative "current plan" ring). */
export interface ActiveSubscription {
  /** Catalog plan id (starter | growth | pro). */
  planId: string
  /** Subscription lifecycle status (active | trialing | …). */
  status: string
}

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing']

/**
 * Best-effort read of the org's active `org_subscriptions` row, or `null` when none / unavailable.
 * Fail-quiet: the row is decorative (drives the current-plan ring), never a hard dependency, so any
 * error or RLS-hidden row resolves to `null`.
 */
export async function fetchActiveSubscription(orgId: string): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('plan_id, status')
    .eq('org_id', orgId)
    .in('status', ACTIVE_SUBSCRIPTION_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  const row = data[0] as { plan_id?: string; status?: string }
  if (!row.plan_id || !row.status) return null
  return { planId: row.plan_id, status: row.status }
}
