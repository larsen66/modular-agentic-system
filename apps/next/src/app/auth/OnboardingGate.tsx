import { useEffect, useState, type ReactNode } from 'react'
import { useCurrentUser } from '@/features/shell/hooks/useCurrentUser'
import { getOnboardingStatus } from '@/core/profile'

// Third rung of the admission ladder (design/auth/flows/auth-guards.md steps 5–6). Reads
// profiles.onboarding_completed via the cached/deduped core op. DEFERRED target (AREA §5): apps/next
// has no onboarding surface yet, so an incomplete status PASSES THROUGH to the shell and logs intent
// rather than redirecting to a non-existent /onboarding. Wiring the redirect is a documented
// follow-up tied to the future Onboarding area. Renders nothing until auth + status resolve.
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    if (!user) {
      setChecked(true)
      return
    }
    getOnboardingStatus(user.id)
      .then((done) => {
        if (!alive) return
        if (!done) {
          // eslint-disable-next-line no-console
          console.info('[OnboardingGate] onboarding incomplete — passing through (no onboarding surface yet)')
        }
      })
      .finally(() => {
        if (alive) setChecked(true)
      })
    return () => {
      alive = false
    }
  }, [user])

  if (loading || !checked) return null
  return <>{children}</>
}
