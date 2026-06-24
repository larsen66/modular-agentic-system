import { useQuery } from '@tanstack/react-query'
import { fetchReferralCode, fetchReferralUsageCount } from '@/core/referral'

// Referral code + usage for the active user/org (server state via core/referral). Builds the
// shareable invite link from the code. Disabled until user/org resolve.
export function useReferral(userId: string | null | undefined, orgId: string | null | undefined) {
  const codeQuery = useQuery<string>({
    queryKey: ['shell', 'referral', userId ?? null, orgId ?? null],
    queryFn: () => fetchReferralCode(userId as string, orgId as string),
    enabled: Boolean(userId && orgId),
    staleTime: 5 * 60_000,
  })
  const usageQuery = useQuery<number>({
    queryKey: ['shell', 'referralUsage', userId ?? null],
    queryFn: () => fetchReferralUsageCount(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const code = codeQuery.data ?? null
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bos.pro'
  const link = code ? `${origin}/?ref=${code}` : null

  return { code, link, usageCount: usageQuery.data ?? 0, loading: codeQuery.isLoading }
}
