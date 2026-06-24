import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Session access (the proven wiring from the connectivity test, now behind the seam).
// The island shares the same-origin Supabase session with the legacy app — getSession() reads
// the stored session reliably (getUser() returned null in the island), and onAuthStateChange
// keeps it fresh. Framework-agnostic; the React hook (features/nav/useSession) is a thin wrapper.

/** Resolve the current signed-in user from the shared same-origin session, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

/**
 * The current session's access token (Supabase JWT), or null when signed out. The seam's typed
 * token op — callers (e.g. the child-app mount handshake) get the JWT here instead of importing the
 * Supabase client directly (boundary Rule 1: the client is core-internal).
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Subscribe to auth changes. Calls `cb` with the current user whenever the session is
 * established, refreshed, or cleared. Returns an unsubscribe function.
 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  const { data: sub } = supabase.auth.onAuthStateChange((_event: unknown, session: Session | null) => {
    cb(session?.user ?? null)
  })
  return () => sub.subscription.unsubscribe()
}

/** Sign the user out of the shared same-origin session. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`signOut failed: ${error.message}`)
}

/**
 * Sign in with email + password. Returns null on success, or an error message string on failure.
 * Wraps supabase.auth.signInWithPassword following the same pattern as signOut.
 */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return error.message
  return null
}

/**
 * Returns the ID of the most recent live opencode session for a project, or null if none.
 * Used by FilesPanel to decide whether to fetch the live workspace tree from the runner.
 * Note: opencode_sessions.status is 'active'|'paused'|'archived' — not runner health values.
 * Both 'active' AND 'paused' count as live (status.ts treats them the same for display); only
 * 'archived' is truly gone. Filtering to `status='active'` alone hid files for paused sessions.
 */
export async function fetchActiveSessionForProject(projectId: string): Promise<string | null> {
  const { data } = await supabase
    .from('opencode_sessions')
    .select('id')
    .eq('project_id', projectId)
    .neq('status', 'archived')
    .order('last_active_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}
