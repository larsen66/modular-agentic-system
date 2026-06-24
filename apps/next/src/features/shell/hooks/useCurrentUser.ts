import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getCurrentUser, onAuthChange } from '@/core/session'
import type { CurrentUser } from '../types'

// Current signed-in user, kept fresh via the shared same-origin session. Thin React wrapper over
// the core/session seam — the island never touches the Supabase client directly.
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getCurrentUser()
      .then((u) => {
        if (alive) setUser(u)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    const off = onAuthChange((u) => {
      if (alive) setUser(u)
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  return { user, loading }
}

/** Friendly first name for labels: first word of full_name → email local-part → null. */
export function deriveDisplayName(user: User | null): string | null {
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim()
  if (name) {
    const first = name.split(/\s+/).filter(Boolean)[0]
    if (first) return first
  }
  const local = user?.email?.split('@')[0]?.trim()
  return local || null
}

/** Initials for an avatar fallback: full_name initials → email[0:2] → "?". */
export function deriveInitials(user: User | null): string {
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    const initials = parts.slice(0, 2).map((p) => p[0]).join('')
    if (initials) return initials.toUpperCase()
  }
  const email = user?.email
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}
