import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** OAuth providers wired in this app (narrow union — avoids the cross-package Provider type). */
export type OAuthProvider = 'google' | 'github'

// Auth operations seam (Constitution v1.3.0 Principle X + design/auth/AREA.md §5).
//
// CORE-INTERNAL boundary: only `src/core/**` imports the Supabase client. Every auth screen/flow
// in `features/auth/**` consumes the TYPED ops below — never the client directly. This is the one
// home for sign-up, OAuth, magic-link, password reset, email verification, profile, and the
// workspace-invitation RPCs. The session primitives (getCurrentUser / onAuthChange / signOut /
// signInWithPassword) live in `core/session.ts` and are re-exported here so callers have a single
// auth import surface.
//
// Real backend only ([[VIII]]): these hit the real Supabase auth API, the real `send-verification-
// email` / `verify-token` edge functions, and the real `get_workspace_invitation_summary` /
// `accept_workspace_invitation` RPCs. No mocks, no simulated success.

export { getCurrentUser, getAccessToken, onAuthChange, signOut, signInWithPassword } from './session'

/** Origin used to build email/OAuth redirect targets.
 *  VITE_SITE_URL wins when set (allows CF Pages deployments to pin the redirect to their own
 *  origin without relying on Supabase's Site URL fallback).
 */
function origin(): string {
  const env = import.meta.env as Record<string, string | undefined>
  return (env.VITE_SITE_URL ?? '').replace(/\/+$/, '') || window.location.origin
}

/** Normalize an email the same way across every op (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** The common result shape: `error` is a human-readable message string, or null on success. */
export interface AuthOpResult {
  error: string | null
}

export interface SignUpResult extends AuthOpResult {
  userId: string | null
  /** True when Supabase reports the email already has an account — caller routes to /login. */
  alreadyRegistered: boolean
}

/**
 * Create an account with email + password. Stores `full_name` (and optional landing-intent prompt /
 * referral code) in user_metadata, then triggers the verification email. Detects the
 * already-registered case so the caller can bounce to /login with the email prefilled.
 */
export async function signUpWithPassword(
  emailRaw: string,
  password: string,
  fullName: string,
  opts?: { referralCode?: string; landingIntentPrompt?: string; locale?: string },
): Promise<SignUpResult> {
  const email = normalizeEmail(emailRaw)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        ...(opts?.referralCode ? { referral_code: opts.referralCode } : {}),
        ...(opts?.landingIntentPrompt ? { landing_intent_prompt: opts.landingIntentPrompt } : {}),
      },
      emailRedirectTo: `${origin()}/auth/verify`,
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    const alreadyRegistered = msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')
    return { userId: null, error: error.message, alreadyRegistered }
  }

  // Supabase returns a user with an empty identities array when the email already exists but is
  // unconfirmed (no error thrown) — treat that as already-registered too.
  const identities = data.user?.identities
  if (identities && identities.length === 0) {
    return { userId: data.user?.id ?? null, error: null, alreadyRegistered: true }
  }

  const userId = data.user?.id ?? null
  // Best-effort: send our branded verification email. A failure here is non-fatal — the user can
  // resend from /verify-email — so we surface it but still report the signup succeeded.
  if (userId) {
    await resendVerificationEmail(email, userId, opts?.locale).catch(() => undefined)
  }
  return { userId, error: null, alreadyRegistered: false }
}

/** Send a passwordless magic-link / OTP sign-in email. */
export async function signInWithMagicLink(emailRaw: string, redirectTo?: string): Promise<AuthOpResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(emailRaw),
    options: { emailRedirectTo: redirectTo ?? `${origin()}/` },
  })
  return { error: error?.message ?? null }
}

/** Begin an OAuth sign-in (PKCE). Redirects the browser to the provider; resolves only on error. */
export async function signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<AuthOpResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo ?? `${origin()}/`,
      ...(provider === 'github' ? { scopes: 'user:email' } : {}),
    },
  })
  return { error: error?.message ?? null }
}

/**
 * Send a password-reset email. The link establishes a short-lived recovery session on
 * /reset-password (detectSessionInUrl), where {@link updatePassword} performs the change.
 * NOTE: this deliberately replaces legacy's `reset-password-direct` edge function, which set a
 * password from just an email address (account-takeover hole) — see AREA §5.
 */
export async function sendResetPasswordEmail(emailRaw: string, redirectTo?: string): Promise<AuthOpResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(emailRaw), {
    redirectTo: redirectTo ?? `${origin()}/reset-password`,
  })
  return { error: error?.message ?? null }
}

/** Set a new password for the current (recovery or signed-in) session. */
export async function updatePassword(password: string): Promise<AuthOpResult> {
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error?.message ?? null }
}

/** Resend the branded verification email via the `send-verification-email` edge function. */
export async function resendVerificationEmail(
  emailRaw: string,
  userId: string,
  locale?: string,
): Promise<AuthOpResult> {
  const { error } = await supabase.functions.invoke('send-verification-email', {
    body: {
      email: normalizeEmail(emailRaw),
      userId,
      type: 'email_verification',
      locale: locale ?? 'en',
      redirectOrigin: origin(),
    },
  })
  return { error: error?.message ?? null }
}

export interface VerifyTokenResult {
  error: string | null
  userId: string | null
}

/** Validate an email-link token via the `verify-token` edge function. */
export async function verifyToken(token: string, type: string): Promise<VerifyTokenResult> {
  const { data, error } = await supabase.functions.invoke('verify-token', { body: { token, type } })
  if (error) return { error: error.message, userId: null }
  const payload = data as { error?: string; userId?: string } | null
  if (payload?.error) return { error: payload.error, userId: null }
  return { error: null, userId: payload?.userId ?? null }
}

export interface InvitationSummary {
  workspaceId: string | null
  workspaceName: string | null
  role: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'invalid'
  email: string | null
  requireEmailVerification: boolean
}

/** Read a workspace-invitation summary by token (anonymous — no session required). */
export async function getWorkspaceInvitationSummary(
  token: string,
): Promise<{ data: InvitationSummary | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_workspace_invitation_summary', { p_token: token })
  if (error) return { data: null, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
  if (!row) return { data: null, error: null }
  const rawStatus = String(row.status ?? 'invalid')
  const status: InvitationSummary['status'] =
    rawStatus === 'pending' || rawStatus === 'accepted' || rawStatus === 'expired' || rawStatus === 'revoked'
      ? rawStatus
      : 'invalid'
  return {
    error: null,
    data: {
      workspaceId: (row.workspace_id as string) ?? null,
      workspaceName: (row.workspace_name as string) ?? null,
      role: (row.role as string) ?? null,
      status,
      email: (row.email as string) ?? null,
      requireEmailVerification: Boolean(row.require_email_verification),
    },
  }
}

export interface AcceptInvitationResult {
  error: string | null
  /** The RPC's error HINT (invalid_token | already_accepted | expired | auth_required | … ) when present. */
  hint: string | null
  workspaceId: string | null
}

/** Accept a workspace invitation (requires a signed-in, email-verified session). */
export async function acceptWorkspaceInvitation(token: string): Promise<AcceptInvitationResult> {
  const { data, error } = await supabase.rpc('accept_workspace_invitation', { p_token: token })
  if (error) {
    // Supabase surfaces Postgres RAISE hints on the error object; fall back to message parsing.
    const hint = (error as { hint?: string }).hint ?? null
    return { error: error.message, hint, workspaceId: null }
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
  return { error: null, hint: null, workspaceId: (row?.workspace_id as string) ?? null }
}

/** Update the signed-in user's own profile (auth metadata + the `profiles` row). */
export async function updateOwnProfile(fields: {
  fullName?: string
  avatarUrl?: string
}): Promise<AuthOpResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user as User | undefined
  if (!user) return { error: 'Not signed in' }

  const metadata: Record<string, unknown> = {}
  if (fields.fullName !== undefined) metadata.full_name = fields.fullName.trim()
  if (fields.avatarUrl !== undefined) metadata.avatar_url = fields.avatarUrl
  const { error: authError } = await supabase.auth.updateUser({ data: metadata })
  if (authError) return { error: authError.message }

  const profileUpdate: Record<string, unknown> = {}
  if (fields.fullName !== undefined) profileUpdate.full_name = fields.fullName.trim()
  if (fields.avatarUrl !== undefined) profileUpdate.avatar_url = fields.avatarUrl
  if (Object.keys(profileUpdate).length > 0) {
    // `as never`: supabase-js rejects a widened Record<string,unknown> payload on typed .update().
    const { error: profileError } = await supabase.from('profiles').update(profileUpdate as never).eq('id', user.id)
    if (profileError) return { error: profileError.message }
  }
  return { error: null }
}

/** Whether the signed-in user has confirmed their email. */
export function isEmailVerified(user: User | null): boolean {
  if (!user) return false
  // Supabase sets email_confirmed_at (and/or confirmed_at) once the email is verified.
  return Boolean(user.email_confirmed_at ?? (user as { confirmed_at?: string }).confirmed_at)
}
