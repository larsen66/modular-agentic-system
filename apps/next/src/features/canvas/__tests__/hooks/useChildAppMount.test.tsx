import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Control the access-layer seam so the handshake FSM is observable without Supabase/runner.
const resolveAppNode = vi.fn()
const resolveMaterializedMount = vi.fn()
const mintInitPayload = vi.fn()
const getSession = vi.fn<() => Promise<{ data: { session: { access_token: string } | null } }>>()

vi.mock('@/core/childMount', async () => {
  const actual = await vi.importActual<typeof import('@/core/childMount')>('@/core/childMount')
  return {
    ...actual,
    resolveAppNode: (...a: unknown[]) => resolveAppNode(...a),
    resolveMaterializedMount: (...a: unknown[]) => resolveMaterializedMount(...a),
    mintInitPayload: (...a: unknown[]) => mintInitPayload(...a),
  }
})
vi.mock('@/core/runtime', () => ({ getAgentStudioRuntime: () => 'baked' }))
vi.mock('@/core/runner', () => ({ RUNNER_URL: 'https://runner.test' }))
vi.mock('@/core/supabase', () => ({ supabase: { auth: { getSession: () => getSession() } } }))
vi.mock('@/state/uiStore', () => ({ useUiStore: (sel: (s: { language: string }) => unknown) => sel({ language: 'en' }) }))

import { useChildAppMount } from '@/features/canvas/hooks/useChildAppMount'

const BAKED_NODE = {
  mode: 'baked' as const,
  node: { id: 'n1', slug: 'studio', config_overlay: { internal_mount_path: '/internal/studio/' } },
  bakedMountPath: '/internal/studio/',
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  mintInitPayload.mockResolvedValue({
    type: 'AOS_INIT',
    version: 1,
    platformJwt: 'jwt',
    supabaseUrl: 'https://p.supabase.co',
    supabasePublishableKey: 'anon',
    mountId: 'n1',
    hostOrigin: window.location.origin,
  })
})
afterEach(() => {
  vi.clearAllMocks()
})

/** Mount a fake iframe + register it, so the hook can post AOS_INIT into a contentWindow. */
function attachIframe(result: { current: ReturnType<typeof useChildAppMount> }) {
  const posted: Array<{ msg: unknown; origin: string }> = []
  const el = {
    contentWindow: {
      postMessage: (msg: unknown, origin: string) => posted.push({ msg, origin }),
    },
  } as unknown as HTMLIFrameElement
  act(() => result.current.registerIframe(el))
  return posted
}

describe('useChildAppMount — no-such-app', () => {
  it('renders the error view when the node does not resolve', async () => {
    resolveAppNode.mockResolvedValue(null)
    const { result } = renderHook(() => useChildAppMount('ghost'))
    await act(async () => {})
    await waitFor(() => expect(result.current.view).toEqual({ kind: 'error', reason: 'no-such-app' }))
  })
})

describe('useChildAppMount — misconfigured (terminal, no retry)', () => {
  it('surfaces the reason', async () => {
    resolveAppNode.mockResolvedValue({ mode: 'misconfigured', node: BAKED_NODE.node, bakedMountPath: null, reason: 'no_internal_mount_path' })
    const { result } = renderHook(() => useChildAppMount('x'))
    await act(async () => {})
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'error', reason: 'misconfigured', detail: 'no_internal_mount_path' }))
  })
})

describe('useChildAppMount — baked handshake', () => {
  it('resolves baked → loading, sends AOS_INIT on iframe load, ready on a valid ACK', async () => {
    resolveAppNode.mockResolvedValue(BAKED_NODE)
    const { result } = renderHook(() => useChildAppMount('studio'))
    await act(async () => {})
    await waitFor(() => expect(result.current.iframeSrc).toContain('/internal/studio/?mountId=n1'))
    expect(result.current.view).toMatchObject({ kind: 'loading' })

    const posted = attachIframe(result)
    await act(async () => {
      result.current.onIframeLoad()
    })
    await waitFor(() => expect(posted.length).toBe(1))
    // targetOrigin is the host origin (baked, same-origin) — NEVER '*'.
    expect(posted[0].origin).toBe(window.location.origin)
    expect((posted[0].msg as { type: string }).type).toBe('AOS_INIT')

    // A valid ACK (origin + mountId + version) flips to ready.
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'AOS_INIT_ACK', version: 1, mountId: 'n1' },
      }))
    })
    await waitFor(() => expect(result.current.view).toEqual({ kind: 'ready' }))
  })

  it('IGNORES an ACK from a wrong origin / mountId / version', async () => {
    resolveAppNode.mockResolvedValue(BAKED_NODE)
    const { result } = renderHook(() => useChildAppMount('studio'))
    await act(async () => {})
    await waitFor(() => expect(result.current.iframeSrc).toBeTruthy())
    const posted = attachIframe(result)
    await act(async () => result.current.onIframeLoad())
    await waitFor(() => expect(posted.length).toBe(1))

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', data: { type: 'AOS_INIT_ACK', version: 1, mountId: 'n1' } }))
      window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'AOS_INIT_ACK', version: 2, mountId: 'n1' } }))
      window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'AOS_INIT_ACK', version: 1, mountId: 'other' } }))
    })
    expect(result.current.view).not.toEqual({ kind: 'ready' })
  })

  it('retries the handshake 3× then fails (5s timer per attempt)', async () => {
    resolveAppNode.mockResolvedValue(BAKED_NODE)
    const { result } = renderHook(() => useChildAppMount('studio'))
    await act(async () => {})
    await waitFor(() => expect(result.current.iframeSrc).toBeTruthy())
    attachIframe(result)

    // Fake timers must be installed BEFORE the handshake so the 5s ACK timer is itself a fake timer
    // (a real timer scheduled first would never fire under `advanceTimersByTimeAsync`).
    vi.useFakeTimers()
    try {
      // attempt 1 (mint #1) — flush the async mint + the init-sent dispatch.
      await act(async () => {
        result.current.onIframeLoad()
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(mintInitPayload).toHaveBeenCalledTimes(1)
      // No ACK → each 5s timeout fires the next attempt (MAX_INIT_ATTEMPTS = 3).
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(mintInitPayload).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(mintInitPayload).toHaveBeenCalledTimes(3)
      // The 3rd timeout exhausts the retries → failed.
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(result.current.view).toMatchObject({ kind: 'error', reason: 'failed' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useChildAppMount — materialized', () => {
  it('attaches the runner then mounts the cross-origin iframe + posts AOS_INIT to the preview origin', async () => {
    resolveAppNode.mockResolvedValue({
      mode: 'materialized',
      node: { id: 'n2', slug: 'studio', config_overlay: { materialization_source: { upstream_repo: 'r' } } },
      bakedMountPath: null,
    })
    resolveMaterializedMount.mockResolvedValue({
      previewUrl: 'https://runner.test/sessions/s1/preview/?previewToken=TKN',
      sessionId: 's1',
      iframeOrigin: 'https://runner.test',
    })
    mintInitPayload.mockResolvedValue({ type: 'AOS_INIT', version: 1, mountId: 'n2', platformJwt: 'jwt', supabaseUrl: 'u', supabasePublishableKey: 'a', hostOrigin: window.location.origin })

    const { result } = renderHook(() => useChildAppMount('studio'))
    await act(async () => {})
    await waitFor(() => expect(result.current.iframeSrc).toContain('previewToken=TKN'))

    const posted = attachIframe(result)
    // Materialized kicks AOS_INIT once the iframe is mounted with a materialized src (no load wait).
    await act(async () => result.current.onIframeLoad())
    await waitFor(() => expect(posted.length).toBeGreaterThanOrEqual(1))
    expect(posted[0].origin).toBe('https://runner.test') // cross-origin targetOrigin, never '*'
  })

  it('no Supabase session → no-session error', async () => {
    resolveAppNode.mockResolvedValue({
      mode: 'materialized',
      node: { id: 'n2', slug: 'studio', config_overlay: { materialization_source: { upstream_repo: 'r' } } },
      bakedMountPath: null,
    })
    getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useChildAppMount('studio'))
    await act(async () => {})
    await waitFor(() => expect(result.current.view).toEqual({ kind: 'error', reason: 'no-session' }))
  })
})
