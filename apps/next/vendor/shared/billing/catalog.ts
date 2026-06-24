/**
 * shared/billing/catalog.ts
 *
 * SINGLE SOURCE OF TRUTH for all pricing, packaging, and billing constants.
 *
 * Consumed by:
 *   - Frontend (Vite):        import { ... } from '@shared/billing/catalog'
 *   - Runner-service (Node):  import { ... } from '@shared/billing/catalog'
 *   - Deno edge functions:    copied by scripts/sync-shared-billing-to-edge.sh
 *
 * Rules:
 *   1. Runtime-neutral — no React, no Deno, no Node-specific imports.
 *   2. All monetary values stored as BOTH `priceUsd` (display) and
 *      `amountCents` (Stripe / backend math).  amountCents is the authority.
 *   3. Stripe price IDs use `_test` / `_live` suffixes so the correct ID can
 *      be selected at runtime via `resolveStripeId()`.
 *   4. Terminology: the user-facing unit is a "credit", never "token".
 */

// ---------------------------------------------------------------------------
// 0. Canonical terminology & economic constants
// ---------------------------------------------------------------------------

/** User-facing unit name. All UI copy MUST use this term. */
export const CREDIT_TERM = 'credit' as const;

/** 1 credit = $0.01 face value */
export const CREDIT_FACE_VALUE_USD = 0.01;

/** Platform markup over upstream LLM cost (20 %) */
export const PLATFORM_MARKUP_RATE = 0.20;

/**
 * product-factory-lane markup over upstream cost (25 %). Q13 founder decision:
 * the factory lane carries +25% (DISTINCT from the 20% platform authority) to
 * cover non-billable failures/declines that the success-only debit never charges.
 */
export const FACTORY_LANE_MARKUP_RATE = 0.25;

/**
 * product-factory-lane: credits charged for a factory run = ceil(actual upstream
 * cost_usd × (1 + FACTORY_LANE_MARKUP_RATE) / face value). Uses the lane's own
 * +25% markup (Q13), distinct from the platform's 20%. Success-only; failed/
 * declined runs are not charged.
 */
export function factoryLaneCreditsForCostUsd(costUsd: number): number {
  if (!(costUsd > 0)) return 0;
  return Math.ceil((costUsd * (1 + FACTORY_LANE_MARKUP_RATE)) / CREDIT_FACE_VALUE_USD);
}

/** Admission balance estimate per lane stage (credits) — p90 from 2026-06-12 server data. */
export const FACTORY_LANE_STAGE_ESTIMATE_CREDITS = {
  mock: 50,
  edit: 100,
  spec: 100,
  stack: 1600,
} as const;

/** Credits granted to every new user on first sign-up */
export const NEWCOMER_GRANT_CREDITS = 10;

/** Support note shown near checkout CTAs */
export const PRICING_SUPPORT_NOTE = 'Payments processed securely via Stripe.';

/** Annual billing discount (15% off monthly price) */
export const ANNUAL_DISCOUNT_PERCENT = 15;

/**
 * Per-tier feature lists shown by every Plans surface (public /pricing,
 * UX2 PricingDemo, Settings → Plans, top-up dialog).
 *
 * Indexed by `CreditPackage.id` / `SubscriptionPlan.id`. Edits here propagate
 * to all consumers — no host may declare its own tierFeatures literal
 * (BE01 acceptance #4 + ADR 0008 §D1).
 */
export const TIER_FEATURES: Readonly<Record<string, readonly string[]>> = {
  starter: ['1 workspace', '1 user', 'Community support'],
  growth: ['5 workspaces', '10 users', 'Priority support', 'Custom agents', 'Local model option'],
  pro: ['Unlimited workspaces', 'Unlimited users', 'Dedicated support', 'Custom agents', 'Local models & data', 'SSO & audit log'],
};

/** Look up the feature list for a given tier id. Returns [] when not configured. */
export function getTierFeatures(id: string): readonly string[] {
  return TIER_FEATURES[id] ?? [];
}

/**
 * Referral reward shape — concrete values to be finalised in Wave 4.
 * Import this type now so downstream code can prepare the plumbing.
 */
export interface ReferralRewardConfig {
  /** Credits awarded to the referrer */
  referrerCredits: number;
  /** Credits awarded to the referee (new user) */
  refereeCredits: number;
  /** Maximum referrals that earn rewards per user (0 = unlimited) */
  maxRewardsPerUser: number;
}

/**
 * Placeholder — values will be set in W4.
 * Importing code should treat `null` fields as "not yet configured".
 */
export const REFERRAL_REWARD: ReferralRewardConfig = {
  referrerCredits: 10,
  refereeCredits: 10,
  maxRewardsPerUser: 200,  // inviter cap (200 / 10 = max 20 referrals)
};

// ---------------------------------------------------------------------------
// 1. Types
// ---------------------------------------------------------------------------

export interface StripePriceIds {
  /** Stripe Price ID for test mode (pk_test_*) */
  test: string;
  /** Stripe Price ID for live mode (pk_live_*) */
  live: string;
}

/**
 * F3b (founder-confirmed 2026-05-11) — split Price IDs per Stripe mode.
 *
 * Every bucket eligible for Stripe checkout SHALL carry distinct Price IDs for
 * the `payment` (one-time top-up) and `subscription` (recurring auto-refill)
 * modes. Stripe Price objects are typed `one_time` or `recurring` and CANNOT
 * be shared safely across modes; sharing an ID across modes is CI-lint-blocked
 * by the F3b-IMPL workpack.
 *
 * - `payment` is set when the bucket is purchasable as a one-time top-up.
 * - `subscription` is set when the bucket is selectable as a monthly auto-refill.
 * - A bucket eligible for both motions has non-null values in both.
 * - A bucket eligible for only one motion sets the unused mode to `undefined`
 *   and pairs that with `subscription_eligible=false` or `payment_eligible=false`
 *   on the bucket row so the edge function rejects payloads referencing the
 *   inactive mode.
 *
 * @see `openspec/changes/simplified-reliable-builder/specs/provider-subscription-selection/spec.md`
 *      Requirement: Stripe Payment-mode and Subscription-mode Price IDs are distinct fields
 * @see `ceo/local/vision/specs/billing/BILLING_SPEC.md §2.3.1 Plans And Buckets Model`
 * @see `ceo/local/vision/specs/billing/BILLING_SPEC.md §2.3 Subscription Plans`
 */
export interface StripePriceIdsByMode {
  /** Price ID set when this bucket is purchasable as one-time top-up. */
  payment?: StripePriceIds;
  /** Price ID set when this bucket is selectable as recurring subscription. */
  subscription?: StripePriceIds;
}

/** Stripe checkout mode for which a bucket Price ID is resolved. */
export type StripePriceMode = 'payment' | 'subscription';

/** A selectable credit amount within a tier (Lovable-style dropdown) */
export interface CreditOption {
  credits: number;
  priceUsd: number;
  amountCents: number;
  priceLabel: string;
  /**
   * @deprecated F3b 2026-05-11 — use `stripePriceIdsByMode` instead. Legacy
   * single-mode field, retained for backward compat during the F3b-IMPL
   * cutover. Treat as the `payment` mode value when `stripePriceIdsByMode`
   * is unset on this row.
   */
  stripePriceIds: StripePriceIds | null;
  /**
   * F3b (founder-confirmed 2026-05-11) — split Price IDs per Stripe mode.
   * Set when the bucket is wired with dashboard-managed Stripe Prices for
   * one or both checkout motions. See `StripePriceIdsByMode` for the
   * non-null-on-active-mode rule and the CI-lint contract.
   */
  stripePriceIdsByMode?: StripePriceIdsByMode;
  /**
   * F3b — whether this bucket is purchasable as a one-time top-up. Defaults
   * to `true` when unset (legacy top-up rows). Set to `false` to mark the
   * bucket subscription-only.
   */
  payment_eligible?: boolean;
  /**
   * F3b — whether this bucket is selectable as a recurring subscription.
   * Defaults to `false` when unset (legacy top-up rows did not expose
   * subscription buckets). The F3b-IMPL workpack flips this to `true` once
   * subscription Price IDs are created in the Stripe dashboard.
   */
  subscription_eligible?: boolean;
}

export interface CreditPackage {
  /** Machine-readable slug, e.g. "starter" */
  id: string;
  /** Human-readable name shown in UI */
  name: string;
  /** Default credit amount (shown initially in the selector) */
  credits: number;
  /** Display price in USD for the default amount */
  priceUsd: number;
  /** Formatted price label for UI (e.g. "$10") */
  priceLabel: string;
  /** Stripe-authoritative price in cents for the default amount */
  amountCents: number;
  /** Effective cost per credit in this tier (USD) */
  perCreditUsd: number;
  /** Formatted per-credit string for UI (e.g. "$0.10 / credit") */
  perCredit: string;
  /** Whether this package is highlighted as popular/recommended */
  popular: boolean;
  /** Short UI description */
  description: string;
  /** CTA button label */
  ctaLabel: string;
  /** Trust anchors: short reassurance strings shown near the CTA */
  trustAnchors: string[];
  /** Stripe price IDs for the default amount */
  stripePriceIds: StripePriceIds;
  /** Selectable credit amounts for the dropdown (includes the default) */
  creditOptions: CreditOption[];
  /** @deprecated Use stripePriceIds — legacy flat Stripe product ID */
  stripeProductId?: string;
  /** @deprecated Use stripePriceIds — legacy flat Stripe price ID */
  stripePriceId?: string;
}

export interface SubscriptionPlan {
  /** Machine-readable slug, e.g. "growth" */
  id: string;
  /** Human-readable name shown in UI */
  name: string;
  /** Credits included per billing cycle */
  creditsPerMonth: number;
  /** Display price in USD/month */
  priceUsd: number;
  /** Formatted price label for UI (e.g. "$40/mo") */
  priceLabel: string;
  /** Stripe-authoritative price in cents/month */
  amountCents: number;
  /** Effective cost per credit (USD) */
  perCreditUsd: number;
  /** Formatted per-credit string (e.g. "$0.08 / credit") */
  perCredit: string;
  /** Whether this plan is highlighted as popular/recommended */
  popular: boolean;
  /** Short UI description */
  description: string;
  /** CTA button label */
  ctaLabel: string;
  /** Trust anchors */
  trustAnchors: string[];
  /** Stripe price IDs by environment (legacy single-bucket-per-plan model). */
  stripePriceIds: StripePriceIds;
  /**
   * F3b (founder-confirmed 2026-05-11) — selectable credit-bucket options for
   * this subscription plan. Same shape as `CreditPackage.creditOptions`, so
   * the canonical `PlansAndCredits` component family can render both refill
   * motions from one model. When set, the subscription edge function
   * (`stripe-create-subscription`) accepts `(plan_id, bucket_id)` payloads and
   * resolves the recurring Price ID from `creditOptions[].stripePriceIdsByMode.subscription`.
   * When unset, the legacy fixed-bucket-per-plan behavior applies (one
   * `creditsPerMonth` per plan).
   *
   * @see `ceo/local/vision/specs/billing/BILLING_SPEC.md §2.3 Subscription Plans`
   * @see `ceo/local/vision/specs/billing/BILLING_SPEC.md §2.3.1 Plans And Buckets Model`
   */
  creditOptions?: CreditOption[];
  /** @deprecated Use stripePriceIds */
  stripeProductId?: string;
  /** @deprecated Use stripePriceIds */
  stripePriceId?: string;
}

export interface FreeTier {
  /** Credits granted on sign-up (newcomer grant) */
  credits: number;
  /** Days before unused free credits expire (0 = never) */
  expiryDays: number;
}

// ---------------------------------------------------------------------------
// 2. Credit packages (one-time purchase)
// ---------------------------------------------------------------------------

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 100,
    priceUsd: 10,
    priceLabel: '$10',
    amountCents: 1_000,
    perCreditUsd: 0.10,
    perCredit: '$0.10 / credit',
    popular: false,
    description: 'Try risk-free — only pay for what works',
    ctaLabel: 'Buy',
    trustAnchors: [
      'Buy credits anytime — or subscribe for automatic monthly refills',
      'Paid credits never expire',
      'No seat tax — your whole team shares one wallet',
      'Protected retries free — you never pay for AI mistakes',
      'Planning & QA chats cost zero credits',
    ],
    stripePriceIds: { test: 'price_1TFI0FCpFCcsfuuy1RxE8Mg8', live: 'price_1TFI0FCpFCcsfuuy1RxE8Mg8' },
    stripeProductId: 'prod_UDjTk5KuyTENZp',
    stripePriceId: 'price_1TFI0FCpFCcsfuuy1RxE8Mg8',
    creditOptions: [
      { credits: 50,  priceUsd: 5,   amountCents: 500,   priceLabel: '$5',   stripePriceIds: null },
      { credits: 100, priceUsd: 10,  amountCents: 1_000, priceLabel: '$10',  stripePriceIds: { test: 'price_1TFI0FCpFCcsfuuy1RxE8Mg8', live: 'price_1TFI0FCpFCcsfuuy1RxE8Mg8' }, stripePriceIdsByMode: { payment: { test: 'price_1TKdvECpFCcsfuuyOUtT72hu', live: 'price_1TKdvECpFCcsfuuyOUtT72hu' } }, payment_eligible: true },
      { credits: 200, priceUsd: 20,  amountCents: 2_000, priceLabel: '$20',  stripePriceIds: null },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    credits: 500,
    priceUsd: 40,
    priceLabel: '$40',
    amountCents: 4_000,
    perCreditUsd: 0.08,
    perCredit: '$0.08 / credit',
    popular: true,
    description: 'Best per-credit value — popular with teams',
    ctaLabel: 'Buy',
    trustAnchors: [
      'Buy credits anytime — or subscribe for automatic monthly refills',
      'Paid credits never expire',
      'No seat tax — your whole team shares one wallet',
      'Protected retries free — you never pay for AI mistakes',
      'Planning & QA chats cost zero credits',
    ],
    stripePriceIds: { test: 'price_1TFI0fCpFCcsfuuySXtWQhcG', live: 'price_1TFI0fCpFCcsfuuySXtWQhcG' },
    stripeProductId: 'prod_UDjTdIatb7tPX1',
    stripePriceId: 'price_1TFI0fCpFCcsfuuySXtWQhcG',
    creditOptions: [
      { credits: 200,  priceUsd: 16,  amountCents: 1_600,  priceLabel: '$16',  stripePriceIds: null },
      { credits: 400,  priceUsd: 32,  amountCents: 3_200,  priceLabel: '$32',  stripePriceIds: null },
      { credits: 500,  priceUsd: 40,  amountCents: 4_000,  priceLabel: '$40',  stripePriceIds: { test: 'price_1TFI0fCpFCcsfuuySXtWQhcG', live: 'price_1TFI0fCpFCcsfuuySXtWQhcG' }, stripePriceIdsByMode: { payment: { test: 'price_1TKdvKCpFCcsfuuypBmuC14A', live: 'price_1TKdvKCpFCcsfuuypBmuC14A' } }, payment_eligible: true },
      { credits: 800,  priceUsd: 64,  amountCents: 6_400,  priceLabel: '$64',  stripePriceIds: null },
      { credits: 1200, priceUsd: 96,  amountCents: 9_600,  priceLabel: '$96',  stripePriceIds: null },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 2_000,
    priceUsd: 120,
    priceLabel: '$120',
    amountCents: 12_000,
    perCreditUsd: 0.06,
    perCredit: '$0.06 / credit',
    popular: false,
    description: 'For agencies building client apps at scale',
    ctaLabel: 'Buy',
    trustAnchors: [
      'Buy credits anytime — or subscribe for automatic monthly refills',
      'Paid credits never expire',
      'No seat tax — your whole team shares one wallet',
      'Protected retries free — you never pay for AI mistakes',
      'Planning & QA chats cost zero credits',
    ],
    stripePriceIds: { test: 'price_1TFI1fCpFCcsfuuykOhje4j9', live: 'price_1TFI1fCpFCcsfuuykOhje4j9' },
    stripeProductId: 'prod_UDjUjnY3iO1BL5',
    stripePriceId: 'price_1TFI1fCpFCcsfuuykOhje4j9',
    creditOptions: [
      { credits: 1000,  priceUsd: 60,   amountCents: 6_000,   priceLabel: '$60',   stripePriceIds: null },
      { credits: 2000,  priceUsd: 120,  amountCents: 12_000,  priceLabel: '$120',  stripePriceIds: { test: 'price_1TFI1fCpFCcsfuuykOhje4j9', live: 'price_1TFI1fCpFCcsfuuykOhje4j9' }, stripePriceIdsByMode: { payment: { test: 'price_1TKdvTCpFCcsfuuyfmmsAnpU', live: 'price_1TKdvTCpFCcsfuuyfmmsAnpU' } }, payment_eligible: true },
      { credits: 3000,  priceUsd: 180,  amountCents: 18_000,  priceLabel: '$180',  stripePriceIds: null },
      { credits: 5000,  priceUsd: 300,  amountCents: 30_000,  priceLabel: '$300',  stripePriceIds: null },
      { credits: 10000, priceUsd: 600,  amountCents: 60_000,  priceLabel: '$600',  stripePriceIds: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. Subscription plans (recurring)
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    creditsPerMonth: 100,
    priceUsd: 10,
    priceLabel: '$10/mo',
    amountCents: 1_000,
    perCreditUsd: 0.10,
    perCredit: '$0.10 / credit',
    popular: false,
    description: '100 credits renewed monthly',
    ctaLabel: 'Subscribe',
    trustAnchors: ['Cancel anytime — no lock-in', 'Credits refill automatically every month', 'Paid credits never expire', 'Top up with credit packs anytime'],
    stripePriceIds: { test: 'price_1Tc5CdECYGtMWMH8qTgyT7EV', live: 'price_1Tc5CdECYGtMWMH8qTgyT7EV' },
    stripeProductId: 'prod_UDjTk5KuyTENZp',
    stripePriceId: 'price_1Tc5CdECYGtMWMH8qTgyT7EV',
    // F3b 2026-05-30 — per-bucket recurring subscription Prices (live Stripe, monthly). test===live until a separate test-mode account is wired.
    creditOptions: [
      { credits: 50,  priceUsd: 5,  amountCents: 500,   priceLabel: '$5/mo',  stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CdECYGtMWMH8zPA2txAu', live: 'price_1Tc5CdECYGtMWMH8zPA2txAu' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 100, priceUsd: 10, amountCents: 1_000, priceLabel: '$10/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CdECYGtMWMH8qTgyT7EV', live: 'price_1Tc5CdECYGtMWMH8qTgyT7EV' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 200, priceUsd: 20, amountCents: 2_000, priceLabel: '$20/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CdECYGtMWMH8yXGPCw5J', live: 'price_1Tc5CdECYGtMWMH8yXGPCw5J' } }, subscription_eligible: true, payment_eligible: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    creditsPerMonth: 500,
    priceUsd: 40,
    priceLabel: '$40/mo',
    amountCents: 4_000,
    perCreditUsd: 0.08,
    perCredit: '$0.08 / credit',
    popular: true,
    description: '500 credits renewed monthly — best value',
    ctaLabel: 'Subscribe',
    trustAnchors: ['Cancel anytime — no lock-in', 'Credits refill automatically every month', 'Paid credits never expire', 'Top up with credit packs anytime', 'Priority support'],
    stripePriceIds: { test: 'price_1Tc5CfECYGtMWMH8bdkgM3d3', live: 'price_1Tc5CfECYGtMWMH8bdkgM3d3' },
    stripeProductId: 'prod_UDjTdIatb7tPX1',
    stripePriceId: 'price_1Tc5CfECYGtMWMH8bdkgM3d3',
    // F3b 2026-05-30 — per-bucket recurring subscription Prices (live Stripe, monthly). test===live until a separate test-mode account is wired.
    creditOptions: [
      { credits: 200,  priceUsd: 16, amountCents: 1_600, priceLabel: '$16/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CeECYGtMWMH8C1QT3kv7', live: 'price_1Tc5CeECYGtMWMH8C1QT3kv7' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 400,  priceUsd: 32, amountCents: 3_200, priceLabel: '$32/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CeECYGtMWMH8EU6DPjvD', live: 'price_1Tc5CeECYGtMWMH8EU6DPjvD' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 500,  priceUsd: 40, amountCents: 4_000, priceLabel: '$40/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CfECYGtMWMH8bdkgM3d3', live: 'price_1Tc5CfECYGtMWMH8bdkgM3d3' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 800,  priceUsd: 64, amountCents: 6_400, priceLabel: '$64/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CfECYGtMWMH8DgOoHYdm', live: 'price_1Tc5CfECYGtMWMH8DgOoHYdm' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 1200, priceUsd: 96, amountCents: 9_600, priceLabel: '$96/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CfECYGtMWMH8UowlWszN', live: 'price_1Tc5CfECYGtMWMH8UowlWszN' } }, subscription_eligible: true, payment_eligible: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    creditsPerMonth: 2_000,
    priceUsd: 120,
    priceLabel: '$120/mo',
    amountCents: 12_000,
    perCreditUsd: 0.06,
    perCredit: '$0.06 / credit',
    popular: false,
    description: '2,000 credits renewed monthly — agency scale',
    ctaLabel: 'Subscribe',
    trustAnchors: ['Cancel anytime — no lock-in', 'Credits refill automatically every month', 'Paid credits never expire', 'Top up with credit packs anytime', 'Dedicated support'],
    stripePriceIds: { test: 'price_1Tc5CgECYGtMWMH8vYMTyXzH', live: 'price_1Tc5CgECYGtMWMH8vYMTyXzH' },
    stripeProductId: 'prod_UDjUjnY3iO1BL5',
    stripePriceId: 'price_1Tc5CgECYGtMWMH8vYMTyXzH',
    // F3b 2026-05-30 — per-bucket recurring subscription Prices (live Stripe, monthly). test===live until a separate test-mode account is wired.
    creditOptions: [
      { credits: 1000,  priceUsd: 60,  amountCents: 6_000,  priceLabel: '$60/mo',  stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CgECYGtMWMH81k6rPmLy', live: 'price_1Tc5CgECYGtMWMH81k6rPmLy' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 2000,  priceUsd: 120, amountCents: 12_000, priceLabel: '$120/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5CgECYGtMWMH8vYMTyXzH', live: 'price_1Tc5CgECYGtMWMH8vYMTyXzH' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 3000,  priceUsd: 180, amountCents: 18_000, priceLabel: '$180/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5ChECYGtMWMH82bnnF59Q', live: 'price_1Tc5ChECYGtMWMH82bnnF59Q' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 5000,  priceUsd: 300, amountCents: 30_000, priceLabel: '$300/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5ChECYGtMWMH8fTJiNiKQ', live: 'price_1Tc5ChECYGtMWMH8fTJiNiKQ' } }, subscription_eligible: true, payment_eligible: false },
      { credits: 10000, priceUsd: 600, amountCents: 60_000, priceLabel: '$600/mo', stripePriceIds: null, stripePriceIdsByMode: { subscription: { test: 'price_1Tc5ChECYGtMWMH83wJ2ZgPy', live: 'price_1Tc5ChECYGtMWMH83wJ2ZgPy' } }, subscription_eligible: true, payment_eligible: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. Free tier
// ---------------------------------------------------------------------------

/**
 * New users receive NEWCOMER_GRANT_CREDITS (10) credits that expire after 30 days.
 *
 * NOTE: The canonical free-tier grant is 10 credits (not 100).
 * Legacy code may reference 100 "tokens" — that is stale.
 */
export const FREE_START_TIER: FreeTier = {
  credits: NEWCOMER_GRANT_CREDITS,
  expiryDays: 30,
};

// ---------------------------------------------------------------------------
// 4b. Plan → profile tier mapping (PA108b)
// ---------------------------------------------------------------------------

/**
 * PA108b — canonical mapping from subscription plan slug to
 * `organizations.package_profile` tier.
 *
 * Consumed by:
 *   - `supabase/functions/stripe-webhook` (billing webhook writer)
 *   - Any future tooling that needs to translate a plan_id to a profile tier.
 *
 * Invariant: keys are the exact plan slugs used in `SUBSCRIPTION_PLANS[].id`.
 * Values are the three allowed `package_profile` CHECK values from migration
 * `20260605010000_organizations_package_profile.sql`.
 *
 * Founder decision (GW-O2 / PA108b):
 *   starter → economy
 *   growth  → moderate
 *   pro     → high
 */
export const PLAN_PROFILE_MAP: Readonly<Record<string, 'economy' | 'moderate' | 'high'>> = {
  starter: 'economy',
  growth:  'moderate',
  pro:     'high',
} as const;

/**
 * Look up the `package_profile` tier for a subscription plan slug.
 * Returns `null` when the plan slug is not in `PLAN_PROFILE_MAP` (unknown plan).
 */
export function getPlanProfile(planId: string): 'economy' | 'moderate' | 'high' | null {
  return PLAN_PROFILE_MAP[planId] ?? null;
}

// ---------------------------------------------------------------------------
// 5. Lookup helpers
// ---------------------------------------------------------------------------

/** Find a credit package by its slug id */
export function getCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Find a configured credit option for a package. Defaults to the package's canonical amount. */
export function getCreditPackageOption(
  packageId: string,
  credits?: number,
): CreditOption | undefined {
  const pkg = getCreditPackage(packageId);
  if (!pkg) return undefined;

  if (credits === undefined) {
    return pkg.creditOptions.find((option) => option.credits === pkg.credits) ?? pkg.creditOptions[0];
  }

  return pkg.creditOptions.find((option) => option.credits === credits);
}

/** Find a subscription plan by its slug id */
export function getSubscriptionPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

/**
 * F3b 2026-05-11 — find a selectable credit bucket inside a subscription plan,
 * mirroring `getCreditPackageOption` for top-up packs. When `credits` is
 * omitted, returns the bucket whose `credits` equals `plan.creditsPerMonth`
 * (the default monthly grant); falls back to the first option.
 *
 * Returns `undefined` when (a) the plan does not exist, (b) the plan has no
 * `creditOptions` (legacy fixed-bucket plan), or (c) the requested `credits`
 * amount is not configured.
 */
export function getSubscriptionPlanBucket(
  planId: string,
  credits?: number,
): CreditOption | undefined {
  const plan = getSubscriptionPlan(planId);
  if (!plan?.creditOptions || plan.creditOptions.length === 0) return undefined;

  if (credits === undefined) {
    return (
      plan.creditOptions.find((option) => option.credits === plan.creditsPerMonth) ??
      plan.creditOptions[0]
    );
  }

  return plan.creditOptions.find((option) => option.credits === credits);
}

/**
 * F3b 2026-05-11 — resolve the Stripe Price ID for a given bucket-and-mode
 * combination. Prefers the new `stripePriceIdsByMode` field; falls back to the
 * legacy `stripePriceIds` (treated as `payment` mode only) so legacy top-up
 * rows continue to work during the F3b-IMPL cutover.
 *
 * Returns `null` when:
 *   - the bucket is not configured for the requested mode (e.g. asking for
 *     `subscription` on a payment-only bucket)
 *   - no dashboard-managed Price ID exists for the bucket+mode pair yet
 *     (CI lint blocks shipping with this state on active modes)
 *
 * @param option   The credit option (bucket).
 * @param mode     `'payment'` for one-time top-up, `'subscription'` for recurring.
 * @param env      `'test'` or `'live'` Stripe environment.
 */
export function getStripePriceIdForBucket(
  option: CreditOption,
  mode: StripePriceMode,
  env: StripeEnv,
): string | null {
  const byMode = option.stripePriceIdsByMode?.[mode];
  if (byMode) return byMode[env];
  // Legacy fallback: treat the flat `stripePriceIds` field as payment-mode only.
  if (mode === 'payment' && option.stripePriceIds) return option.stripePriceIds[env];
  return null;
}

// ---------------------------------------------------------------------------
// 6. Stripe helpers
// ---------------------------------------------------------------------------

export type StripeEnv = 'test' | 'live';

/** Resolve the correct Stripe Price ID for the current environment. */
export function resolveStripeId(ids: StripePriceIds, env: StripeEnv): string {
  return ids[env];
}

// ---------------------------------------------------------------------------
// 7. Annual pricing helpers
// ---------------------------------------------------------------------------

/** Compute the discounted monthly price when billed annually. */
export function annualMonthlyPrice(monthlyUsd: number, discountPercent: number): number {
  return Math.round(monthlyUsd * (1 - discountPercent / 100) * 100) / 100;
}

/** Format an annual price as "$X/mo billed annually". */
export function formatAnnualPrice(monthlyUsd: number, discountPercent: number): string {
  const discounted = annualMonthlyPrice(monthlyUsd, discountPercent);
  return `$${discounted % 1 === 0 ? discounted : discounted.toFixed(2)}/mo`;
}

// ---------------------------------------------------------------------------
// 8. View projections (subset selectors for specific consumers)
// ---------------------------------------------------------------------------

/** Minimal shape needed by UI cards / purchase dialogs */
export interface PackageDisplayView {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  perCreditUsd: number;
  description: string;
  ctaLabel: string;
  trustAnchors: string[];
}

/** Minimal shape needed by backend Stripe integration */
export interface PackageBackendView {
  id: string;
  credits: number;
  amountCents: number;
  stripePriceIds: StripePriceIds;
}

/** Project a CreditPackage to its display-only view */
export function toDisplayView(pkg: CreditPackage): PackageDisplayView {
  return {
    id: pkg.id,
    name: pkg.name,
    credits: pkg.credits,
    priceUsd: pkg.priceUsd,
    perCreditUsd: pkg.perCreditUsd,
    description: pkg.description,
    ctaLabel: pkg.ctaLabel,
    trustAnchors: pkg.trustAnchors,
  };
}

/** Project a CreditPackage to its backend-only view */
export function toBackendView(pkg: CreditPackage): PackageBackendView {
  return {
    id: pkg.id,
    credits: pkg.credits,
    amountCents: pkg.amountCents,
    stripePriceIds: pkg.stripePriceIds,
  };
}

/** All packages as display views — convenience for UI list rendering */
export function allDisplayViews(): PackageDisplayView[] {
  return CREDIT_PACKAGES.map(toDisplayView);
}

/** All packages as backend views — convenience for Stripe integration */
export function allBackendViews(): PackageBackendView[] {
  return CREDIT_PACKAGES.map(toBackendView);
}

// ---------------------------------------------------------------------------
// BFA03 — Speculative-session billing filter
// ---------------------------------------------------------------------------
//
// When the frontend prewarms a session speculatively (during signup profile
// typing or first prompt-focus) the runner tags the session
// `speculative: true`. Billing authority must ignore these sessions until
// they carry a real chat run — otherwise a user who abandons the flow
// right after signup eats container cost they never asked for.
//
// The authority inverts on the first admitted chat run:
// `chatRunPipeline` calls `clearSpeculativeFlag(sessionId)` inside the
// single-writer session mutation path, which flips the flag off. From that
// point on this predicate reports the session as billable.
//
// Callers:
//   - runner-service: session-lifecycle cost aggregation (opt-in)
//   - runner-service: any future "session-minute" event emit
//   - Studio frontend: badge / UI copy ("preparing — not yet billable")

/**
 * Minimal session shape needed for billing filtering. Kept structural so the
 * filter works across the runner's `RunnerSession`, persisted views, and any
 * future edge-function projection without a direct import cycle.
 */
export interface BillableSessionView {
  id?: string;
  speculative?: boolean;
  /** When set, the session has completed at least one real chat run. */
  runId?: string | null;
  status?: string | null;
}

/**
 * Returns true iff this session should accrue session-level billable events.
 *
 * A session is NON-billable while `speculative === true`. The first admitted
 * chat run calls `clearSpeculativeFlag()` on the runner side, flipping
 * `speculative` to `undefined/false` so subsequent billing passes see it as
 * billable. This function never double-checks run count — that would couple
 * billing to a separate source of truth. The single writer is the runner's
 * session registry.
 */
export function isBillableSession(session: BillableSessionView | null | undefined): boolean {
  if (!session) return false;
  if (session.speculative === true) return false;
  return true;
}

/**
 * Inverse of {@link isBillableSession} — explicit for readability at call
 * sites that want to skip/log speculative sessions.
 */
export function isSpeculativeSession(session: BillableSessionView | null | undefined): boolean {
  return Boolean(session && session.speculative === true);
}
