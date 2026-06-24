import { describe, expect, it } from 'vitest'
import { deriveStage } from '@/features/canvas/lib/deriveStage'

describe('deriveStage', () => {
  it('groups create/materialize phases → creating', () => {
    expect(deriveStage('materializing')).toBe('creating')
    expect(deriveStage('workspace-cloned')).toBe('creating')
    expect(deriveStage('creating')).toBe('creating')
  })

  it('groups dependency phases → installing', () => {
    expect(deriveStage('dependencies')).toBe('installing')
    expect(deriveStage('prebuild-hit')).toBe('installing')
    expect(deriveStage('install-skipped')).toBe('installing')
  })

  it('groups build / dev bring-up → building', () => {
    expect(deriveStage('built_building')).toBe('building')
    expect(deriveStage('built_healthcheck')).toBe('building')
    expect(deriveStage('dev_starting')).toBe('building')
    expect(deriveStage('dist-cache-miss')).toBe('building')
  })

  it('maps terminal/transitional phases', () => {
    expect(deriveStage('ready')).toBe('ready')
    expect(deriveStage('recovering')).toBe('recovering')
    expect(deriveStage('error')).toBe('error')
    expect(deriveStage('built-failed')).toBe('error')
    expect(deriveStage('session-evicted')).toBe('error')
  })

  it('defaults unknown/absent phase to the earliest stage', () => {
    expect(deriveStage(null)).toBe('creating')
    expect(deriveStage(undefined)).toBe('creating')
  })
})
