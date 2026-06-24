// Referral capture/persist (design/auth/AREA.md §5 — "carry"). Same-origin compatible with the
// legacy app: it reads/writes the SAME `localStorage.pendingReferralCode` key, so a referral
// captured on either frontend survives into the other. The captured code is passed into
// `signUpWithPassword` user_metadata and is available to the accept-invite flow.

const KEY = 'pendingReferralCode'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Capture a `?ref=` code from the current URL into storage (if present). Returns the code or null. */
export function capturePendingReferralFromUrl(search: string = window.location.search): string | null {
  const code = new URLSearchParams(search).get('ref')?.trim()
  if (!code) return readPendingReferral()
  storage()?.setItem(KEY, code)
  return code
}

/** Read the stashed referral code, or null. */
export function readPendingReferral(): string | null {
  return storage()?.getItem(KEY)?.trim() || null
}

/** Clear the stashed referral code (call after it has been consumed by signup/accept). */
export function clearPendingReferral(): void {
  storage()?.removeItem(KEY)
}
