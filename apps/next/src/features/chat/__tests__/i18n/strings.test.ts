import { describe, expect, it } from 'vitest'
import { en } from '@/features/chat/i18n/en'
import { de } from '@/features/chat/i18n/de'

// Gated EN/DE parity: every key in EN must exist (non-empty) in DE, recursively. Catches missing
// translations when strings are added to en.ts.
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' ? keyPaths(v as Record<string, unknown>, path) : [path]
  })
}

describe('chat i18n', () => {
  it('DE has every EN key (parity)', () => {
    expect(keyPaths(de as unknown as Record<string, unknown>).sort()).toEqual(keyPaths(en as unknown as Record<string, unknown>).sort())
  })

  it('no string value is empty', () => {
    for (const map of [en, de]) {
      const flat = JSON.stringify(map)
      expect(flat).not.toContain('""')
    }
  })
})
