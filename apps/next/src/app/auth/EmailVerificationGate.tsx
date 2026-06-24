import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/features/shell/hooks/useCurrentUser'
import { isEmailVerified } from '@/core/auth'
import { safeReturnTo } from './safeReturnTo'

// Second rung of the admission ladder (design/auth/flows/auth-guards.md step 4). Runs AFTER
// AuthGuard, so a `user` is present. An unverified user is bounced to /verify-email; the deep path
// they were heading to is stashed one-shot in sessionStorage (survives the email round-trip, unlike
// router state) for auth-verify to consume. Renders nothing while auth state resolves (no flash).
export function EmailVerificationGate({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser()
  const location = useLocation()

  if (loading) return null
  if (user && !isEmailVerified(user)) {
    try {
      sessionStorage.setItem('verifyReturnPath', safeReturnTo(location.pathname + location.search + location.hash))
    } catch {
      // sessionStorage unavailable (private mode) — non-fatal; post-verify falls back to '/'.
    }
    return <Navigate to="/verify-email" replace state={{ email: user.email, userId: user.id }} />
  }
  return <>{children}</>
}
