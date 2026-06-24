// Open-redirect guard for `returnTo` (design/auth/flows/auth-guards.md §4 — parity-critical security).
// Accepts only a same-origin path; rejects protocol-relative (`//evil`, `/\evil`), scheme
// (`javascript:`, `https://x`), and control-char payloads. Returns a normalized safe path, or '/'.
//
// Validation order matters: we reject the obvious protocol-relative / control-char cases first, then
// resolve against a synthetic base so anything that escapes the declared origin collapses to '/'.
const SYNTHETIC_BASE = 'https://island.invalid'

// Control chars (NUL–US + DEL), incl. TAB/newline used to smuggle `/<TAB>/evil.com`.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\x00-\\x1f\\x7f]')

export function safeReturnTo(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/'
  if (CONTROL_CHARS.test(path)) return '/'
  // Must be a rooted path, but not protocol-relative.
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('//') || path.startsWith('/\\')) return '/'
  try {
    const url = new URL(path, SYNTHETIC_BASE)
    if (url.origin !== SYNTHETIC_BASE) return '/'
    const normalized = url.pathname + url.search + url.hash
    // Re-check the resolved path didn't collapse into a protocol-relative form.
    return normalized.startsWith('//') ? '/' : normalized
  } catch {
    return '/'
  }
}
