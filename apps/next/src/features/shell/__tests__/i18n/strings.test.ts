import { describe, expect, it } from 'vitest'
import { en } from '@/features/shell/i18n/en'
import { de } from '@/features/shell/i18n/de'
import { shellStrings } from '@/features/shell/i18n'

// Walk an object to a flat set of dotted key paths (arrays summarized by length so EN/DE step
// lists must match in count). The parity contract: DE mirrors EN key-for-key (ARCHITECTURE §3).
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[len=${obj.length}]`]
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return [prefix]
}

describe('shell i18n parity', () => {
  it('DE mirrors EN key-for-key', () => {
    expect(keyPaths(de).sort()).toEqual(keyPaths(en).sort())
  })

  it('has the same number of invite steps in both locales', () => {
    expect(de.rail.invite.steps).toHaveLength(en.rail.invite.steps.length)
  })

  it('every EN leaf is a non-empty string', () => {
    const leaves: string[] = []
    const collect = (o: unknown) => {
      if (typeof o === 'string') leaves.push(o)
      else if (Array.isArray(o)) o.forEach(collect)
      else if (o && typeof o === 'object') Object.values(o).forEach(collect)
    }
    collect(en)
    expect(leaves.length).toBeGreaterThan(0)
    for (const s of leaves) expect(s.trim().length).toBeGreaterThan(0)
  })

  it('every DE leaf is a non-empty string', () => {
    const leaves: string[] = []
    const collect = (o: unknown) => {
      if (typeof o === 'string') leaves.push(o)
      else if (Array.isArray(o)) o.forEach(collect)
      else if (o && typeof o === 'object') Object.values(o).forEach(collect)
    }
    collect(de)
    for (const s of leaves) expect(s.trim().length).toBeGreaterThan(0)
  })
})

describe('shellStrings', () => {
  it('returns EN for "en"', () => {
    expect(shellStrings('en')).toBe(en)
  })

  it('returns DE for "de"', () => {
    expect(shellStrings('de')).toBe(de)
  })

  it('defaults to EN when called with no argument', () => {
    expect(shellStrings()).toBe(en)
  })

  it('falls back to EN for an unknown language code', () => {
    // @ts-expect-error — exercising the runtime fallback for an unsupported code
    expect(shellStrings('fr')).toBe(en)
  })
})
