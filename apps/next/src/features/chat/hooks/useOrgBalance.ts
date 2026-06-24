import { useQuery } from '@tanstack/react-query'
import { fetchWalletBalance } from '@/core/billing'
import { fetchOrganizations } from '@/core/orgs'
import { getCurrentUser } from '@/core/session'
import { useUiStore } from '@/state/uiStore'

// The org the chat runs under. Mirrors shell's `useActiveOrg` WITHOUT importing it (cross-feature ban,
// ARCHITECTURE §3): the user's explicit pick (`uiStore.activeOrgId`) if set, else their FIRST org —
// because `activeOrgId` is null until the user touches the Rail's org switcher, and the balance gate
// must work regardless. Resolves via the shared `@/core/{session,orgs}` seams; query keys match the
// shell's so react-query dedupes the user/orgs fetches across features.
export function useResolvedOrgId(): string | null {
  const activeOrgId = useUiStore((s) => s.activeOrgId)
  const { data: user } = useQuery({
    queryKey: ['session', 'user'],
    queryFn: getCurrentUser,
    staleTime: 60_000,
  })
  const { data: orgs } = useQuery({
    queryKey: ['shell', 'orgs', user?.id ?? null],
    queryFn: () => fetchOrganizations(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })
  return activeOrgId ?? orgs?.[0]?.id ?? null
}

// The active org's spendable credit balance (server state via the core billing seam). Lets the
// composer warn about low/zero credits BEFORE a send rather than only reacting to the admission
// rejection. Chat-local (no cross-feature import of shell's useWalletBalance — ARCHITECTURE §3);
// the shared reader is `@/core/billing`. Disabled when no org is selected.
export function useOrgBalance(orgId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ['chat', 'orgBalance', orgId ?? null],
    queryFn: () => fetchWalletBalance(orgId as string),
    enabled: Boolean(orgId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

// Minimum balance below which the composer surfaces a proactive notice. `<= 0` → out of credits
// (blocking-feel banner); `< LOW_BALANCE` → a softer "running low" hint. Mirrors the Rail's danger
// tone (<5) so the two readouts agree.
export const LOW_BALANCE = 5
