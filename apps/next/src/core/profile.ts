import { supabase } from './supabase'

// Profile reads behind the core seam. `getOnboardingStatus` is consumed by the OnboardingGate; it
// is cached + in-flight-deduped (design/auth/flows/auth-guards.md step 5/§5 row 7) so a mount-storm
// of guards doesn't fan out N identical queries. Conservative on error: treats status as "complete"
// so a transient failure never traps the user out of the shell.
const statusCache = new Map<string, boolean>()
const inflight = new Map<string, Promise<boolean>>()

export async function getOnboardingStatus(userId: string): Promise<boolean> {
  const cached = statusCache.get(userId)
  if (cached !== undefined) return cached
  const pending = inflight.get(userId)
  if (pending) return pending

  const promise = (async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle()
    inflight.delete(userId)
    if (error) return true // conservative pass-through
    const done = Boolean((data as { onboarding_completed?: boolean } | null)?.onboarding_completed)
    statusCache.set(userId, done)
    return done
  })()
  inflight.set(userId, promise)
  return promise
}

/** Clear the cached onboarding status (e.g. after the user completes onboarding). */
export function invalidateOnboardingStatus(userId: string): void {
  statusCache.delete(userId)
}
