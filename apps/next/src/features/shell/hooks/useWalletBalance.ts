import { useQuery } from '@tanstack/react-query'
import { fetchWalletBalance } from '@/core/billing'
import type { CreditTone } from '../types'

// Spendable credit balance for the active org (server state via core/billing). Polls lazily so
// the Rail's passive readout stays roughly current. Disabled when no org is selected.
export function useWalletBalance(orgId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ['shell', 'walletBalance', orgId ?? null],
    queryFn: () => fetchWalletBalance(orgId as string),
    enabled: Boolean(orgId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

/** Credit-balance emphasis bucket → semantic token. <5 danger · <20 warning · else ok. */
export function creditTone(balance: number | null | undefined): CreditTone {
  if (balance == null) return 'ok'
  if (balance < 5) return 'danger'
  if (balance < 20) return 'warning'
  return 'ok'
}

/**
 * Compact credit count for the rail's small (size="sm") credits button, so a large balance can't
 * widen the fixed 56px rail. Under 1k shows the exact integer; 1k–999k collapses to `k` (one
 * decimal below 10k, e.g. 1.5k), millions to `m`. Display-only — the popover + the button's
 * aria-label keep the precise figure. Worst-case width stays ~4 glyphs ("1.5k", "999k", "12m").
 */
export function formatCredits(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(Math.trunc(n))
  if (abs < 1000) return String(Math.trunc(n))
  if (abs < 1_000_000) {
    const k = n / 1000
    return `${Math.abs(k) < 10 ? Math.round(k * 10) / 10 : Math.round(k)}k`
  }
  const m = n / 1_000_000
  return `${Math.abs(m) < 10 ? Math.round(m * 10) / 10 : Math.round(m)}m`
}
