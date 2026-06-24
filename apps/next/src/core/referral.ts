import { supabase } from './supabase'

// Referral access seam. The referral code is the user's per-org invite slug; usage count is how
// many referrals have progressed past 'pending'. Both feed the Invite + Profile surfaces.

/**
 * Get-or-create the user's referral code for an org (idempotent RPC `get_or_create_referral_code`,
 * returns a 6–8 char uppercase code). Caller guards `enabled` on userId + orgId.
 */
export async function fetchReferralCode(userId: string, orgId: string): Promise<string> {
  const { data, error } = await supabase.rpc(
    'get_or_create_referral_code' as never,
    { p_user_id: userId, p_org_id: orgId } as never,
  )
  if (error) throw new Error(`fetchReferralCode failed: ${error.message}`)
  if (!data) throw new Error('fetchReferralCode returned null')
  return data as unknown as string
}

/** How many of the user's referrals have moved past 'pending'. */
export async function fetchReferralUsageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_user_id', userId)
    .neq('status', 'pending')
  if (error) throw new Error(`fetchReferralUsageCount failed: ${error.message}`)
  return count ?? 0
}
