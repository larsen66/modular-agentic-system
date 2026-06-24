import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreviewSnapshotData } from '@/core/preview'
import { usePreview } from '@/features/canvas/hooks/usePreview'

// Control the access-layer seam so the hook's lifecycle is observable without a runner.
let pushSnapshot: ((s: PreviewSnapshotData) => void) | null = null
const fetchToken = vi.fn<(sid: string) => Promise<string | null>>()
const probeEviction = vi.fn()
const fetchSnapshot = vi.fn()

vi.mock('@/core/preview', async () => {
  const actual = await vi.importActual<typeof import('@/core/preview')>('@/core/preview')
  return {
    ...actual,
    subscribeSnapshot: (_sid: string, onSnapshot: (s: PreviewSnapshotData) => void) => {
      pushSnapshot = onSnapshot
      return () => {
        pushSnapshot = null
      }
    },
    fetchToken: (sid: string) => fetchToken(sid),
    fetchSnapshot: () => fetchSnapshot(),
    probeEviction: () => probeEviction(),
    kickBuilt: vi.fn().mockResolvedValue(undefined),
    clearDevBackoff: vi.fn().mockResolvedValue(undefined),
  }
})

function readySnap(over: Partial<PreviewSnapshotData> = {}): PreviewSnapshotData {
  return {
    sessionId: 's1',
    version: 1,
    sessionEpoch: 1,
    emittedAt: 0,
    runtime: 'docker',
    status: 'ready',
    selectedSurface: 'dev',
    reason: 'dev_running',
    previewPath: '/sessions/s1/preview',
    port: 5173,
    container: { id: 'c1', alive: true, canRestart: true },
    built: { state: 'idle', port: null, healthy: false, source: 'none', buildStartedAt: null, lastBuiltAt: null, buildHash: null, error: null },
    dev: { state: 'running', port: 5173, healthy: true, startedAt: null, lastConfirmedAt: null, failureCount: 0, nextRetryAt: null, error: null },
    progress: null,
    timedOut: false,
    error: null,
    ...over,
  }
}

beforeEach(() => {
  pushSnapshot = null
  fetchToken.mockResolvedValue('tok')
  probeEviction.mockResolvedValue({ evicted: false })
  fetchSnapshot.mockResolvedValue(null)
})

afterEach(() => vi.clearAllMocks())

describe('usePreview', () => {
  it('is no_session without a session id', () => {
    const { result } = renderHook(() => usePreview(null))
    expect(result.current.state).toBe('no_session')
    expect(result.current.previewUrl).toBeNull()
  })

  it('starts provisioning once a session resolves, before any snapshot', () => {
    const { result } = renderHook(() => usePreview('s1'))
    expect(result.current.state).toBe('provisioning')
  })

  it('reaches ready with a token-bearing url after a ready snapshot', async () => {
    const { result } = renderHook(() => usePreview('s1'))
    await waitFor(() => expect(pushSnapshot).toBeTypeOf('function'))
    act(() => pushSnapshot!(readySnap()))
    await waitFor(() => expect(result.current.state).toBe('ready'))
    await waitFor(() => expect(result.current.previewUrl).toContain('previewToken=tok'))
    expect(result.current.previewUrl).toContain('/sessions/s1/preview')
  })

  it('drops a stale (lower-version) snapshot', async () => {
    const { result } = renderHook(() => usePreview('s1'))
    await waitFor(() => expect(pushSnapshot).toBeTypeOf('function'))
    act(() => pushSnapshot!(readySnap({ version: 5 })))
    await waitFor(() => expect(result.current.snapshot?.version).toBe(5))
    act(() => pushSnapshot!(readySnap({ version: 2, status: 'error' })))
    // stale → dropped: still the v5 ready snapshot, not the v2 error
    expect(result.current.snapshot?.version).toBe(5)
    expect(result.current.state).toBe('ready')
  })

  it('surfaces evicted when the probe reports eviction', async () => {
    probeEviction.mockResolvedValue({ evicted: true, reason: 'idle_timeout' })
    const { result } = renderHook(() => usePreview('s1'))
    await waitFor(() => expect(pushSnapshot).toBeTypeOf('function'))
    act(() => pushSnapshot!(readySnap()))
    await waitFor(() => expect(result.current.state).toBe('evicted'))
  })

  it('maps a container_dead snapshot', async () => {
    const { result } = renderHook(() => usePreview('s1'))
    await waitFor(() => expect(pushSnapshot).toBeTypeOf('function'))
    act(() => pushSnapshot!(readySnap({ status: 'container_dead' })))
    await waitFor(() => expect(result.current.state).toBe('container_dead'))
  })
})
