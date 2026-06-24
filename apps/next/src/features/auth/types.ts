// Single types surface for the `auth` feature module (ARCHITECTURE §3). Cross-screen shared types
// live here; screen-local Props stay inside their own screen files. Owned single-writer to avoid
// parallel-edit churn.
export type { AuthScreenProps } from '@/shared/auth/AuthScreen'
export type { PasswordInputProps } from '@/shared/auth/PasswordInput'
export type { OAuthProvider, InvitationSummary, AcceptInvitationResult, VerifyTokenResult } from '@/core/auth'

/** Router location state carried into auth screens (set by guards / cross-links). */
export interface AuthLocationState {
  /** Same-origin path to return to after successful auth (validated via safeReturnTo). */
  returnTo?: string
  /** Email prefill (e.g. duplicate-email bounce from signup → login). */
  email?: string
  /** User id carried from signup → verify-email for resend. */
  userId?: string
}
