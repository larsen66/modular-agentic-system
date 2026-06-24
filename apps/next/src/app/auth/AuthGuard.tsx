import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/features/shell/hooks/useCurrentUser'
import { safeReturnTo } from './safeReturnTo'

// First rung of the admission ladder (design/auth/flows/auth-guards.md step 2–3). Reads the shared
// Supabase session via useCurrentUser. While the initial session check is in-flight, renders nothing
// to avoid a flash of the shell (loading-flash guard). On signed-out, redirects to /login carrying a
// `safeReturnTo`-validated returnTo so Login can resume the original deep link after sign-in.
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    const returnTo = safeReturnTo(location.pathname + location.search + location.hash)
    return <Navigate to="/login" state={{ returnTo }} replace />
  }
  return <>{children}</>
}
