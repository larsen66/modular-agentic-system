import { describe, expect, it } from 'vitest'
import { safeReturnTo } from '@/app/auth/safeReturnTo'

// Open-redirect guard (design/auth/flows/auth-guards.md §4). The rejection matrix is parity-critical
// security — a returnTo that escapes the origin must collapse to '/'.
describe('safeReturnTo', () => {
  it('passes through safe same-origin paths verbatim', () => {
    expect(safeReturnTo('/dashboard')).toBe('/dashboard')
    expect(safeReturnTo('/project/123/chat/abc')).toBe('/project/123/chat/abc')
    expect(safeReturnTo('/settings/org?section=people')).toBe('/settings/org?section=people')
    expect(safeReturnTo('/p?x=1#frag')).toBe('/p?x=1#frag')
  })

  it('falls back to "/" for empty / non-string input', () => {
    expect(safeReturnTo(null)).toBe('/')
    expect(safeReturnTo(undefined)).toBe('/')
    expect(safeReturnTo('')).toBe('/')
  })

  it('rejects protocol-relative targets', () => {
    expect(safeReturnTo('//evil.com')).toBe('/')
    expect(safeReturnTo('//evil.com/path')).toBe('/')
    expect(safeReturnTo('/\\evil.com')).toBe('/')
  })

  it('rejects absolute URLs and schemes (not rooted with a single "/")', () => {
    expect(safeReturnTo('https://evil.com')).toBe('/')
    expect(safeReturnTo('http://evil.com/x')).toBe('/')
    expect(safeReturnTo('javascript:alert(1)')).toBe('/')
    expect(safeReturnTo('mailto:x@y.com')).toBe('/')
  })

  it('rejects relative paths without a leading slash', () => {
    expect(safeReturnTo('dashboard')).toBe('/')
    expect(safeReturnTo('../etc/passwd')).toBe('/')
  })

  it('rejects control-char smuggling (e.g. /<TAB>/evil.com)', () => {
    expect(safeReturnTo('/\t/evil.com')).toBe('/')
    expect(safeReturnTo('/\n/evil.com')).toBe('/')
    expect(safeReturnTo('/\x00')).toBe('/')
  })
})
