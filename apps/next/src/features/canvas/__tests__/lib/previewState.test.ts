import { describe, expect, it } from 'vitest'
import { isDegraded, isNewerSnapshot, mapSnapshotToState } from '@/features/canvas/lib/previewState'
import type { PreviewSnapshotData, PreviewStatus } from '@/core/preview'

// A minimal snapshot factory — only the fields the pure mappers read.
function snap(over: Partial<PreviewSnapshotData> = {}): PreviewSnapshotData {
  return {
    sessionId: 's1',
    version: 1,
    sessionEpoch: 1,
    emittedAt: 0,
    runtime: 'docker',
    status: 'ready',
    selectedSurface: 'built',
    reason: 'built_serving',
    previewPath: '/sessions/s1/preview',
    port: null,
    container: { id: 'c1', alive: true, canRestart: true },
    built: { state: 'serving', port: 4173, healthy: true, source: 'fresh', buildStartedAt: null, lastBuiltAt: 1, buildHash: null, error: null },
    dev: { state: 'idle', port: null, healthy: false, startedAt: null, lastConfirmedAt: null, failureCount: 0, nextRetryAt: null, error: null },
    progress: null,
    timedOut: false,
    error: null,
    ...over,
  }
}

describe('mapSnapshotToState', () => {
  it('collapses degraded → ready (fallback surface is still usable)', () => {
    expect(mapSnapshotToState(snap({ status: 'degraded' }))).toBe('ready')
    expect(mapSnapshotToState(snap({ status: 'ready' }))).toBe('ready')
  })

  it('folds expired into error (same dead-end-with-recovery outcome)', () => {
    expect(mapSnapshotToState(snap({ status: 'expired' }))).toBe('error')
    expect(mapSnapshotToState(snap({ status: 'error' }))).toBe('error')
  })

  it('maps container_dead and provisioning/empty', () => {
    expect(mapSnapshotToState(snap({ status: 'container_dead' }))).toBe('container_dead')
    expect(mapSnapshotToState(snap({ status: 'provisioning' }))).toBe('provisioning')
    expect(mapSnapshotToState(snap({ status: 'empty' }))).toBe('provisioning')
  })

  it.each<PreviewStatus>(['ready', 'degraded', 'provisioning', 'empty', 'expired', 'error', 'container_dead'])(
    'always returns a defined state for status %s',
    (status) => {
      expect(mapSnapshotToState(snap({ status }))).toBeTruthy()
    },
  )
})

describe('isNewerSnapshot (monotonic gate)', () => {
  it('accepts the first snapshot for the active session', () => {
    expect(isNewerSnapshot(null, snap(), 's1')).toBe(true)
  })

  it('rejects a snapshot for a different session', () => {
    expect(isNewerSnapshot(null, snap({ sessionId: 'other' }), 's1')).toBe(false)
  })

  it('accepts a strictly increasing version in the same epoch', () => {
    expect(isNewerSnapshot(snap({ version: 1 }), snap({ version: 2 }), 's1')).toBe(true)
    expect(isNewerSnapshot(snap({ version: 2 }), snap({ version: 2 }), 's1')).toBe(false)
    expect(isNewerSnapshot(snap({ version: 3 }), snap({ version: 2 }), 's1')).toBe(false)
  })

  it('adopts a newer epoch even if version resets (epoch wins over version)', () => {
    expect(isNewerSnapshot(snap({ sessionEpoch: 1, version: 99 }), snap({ sessionEpoch: 2, version: 1 }), 's1')).toBe(true)
  })

  it('rejects an older epoch', () => {
    expect(isNewerSnapshot(snap({ sessionEpoch: 2, version: 1 }), snap({ sessionEpoch: 1, version: 99 }), 's1')).toBe(false)
  })
})

describe('isDegraded', () => {
  it('classifies the degraded family but not provisioning/ready', () => {
    expect(isDegraded('error')).toBe(true)
    expect(isDegraded('evicted')).toBe(true)
    expect(isDegraded('router_upgrade')).toBe(true)
    expect(isDegraded('container_dead')).toBe(true)
    expect(isDegraded('ready')).toBe(false)
    expect(isDegraded('provisioning')).toBe(false)
  })
})
