import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Supabase config + client seam. SUPABASE_PUBLISHABLE_KEY defaults to an anon-role JWT.
const ANON_JWT = makeJwt({ role: 'anon' })
let publishableKey = ANON_JWT
const getSession = vi.fn<() => Promise<{ data: { session: { access_token: string } | null } }>>()
const maybeSingle = vi.fn()
const eq2 = vi.fn(() => ({ maybeSingle }))
const eq1 = vi.fn(() => ({ eq: eq2 }))
const select = vi.fn(() => ({ eq: eq1 }))
const from = vi.fn((_t: string) => ({ select }))

vi.mock('@core/integrations/supabase/client', () => ({
  get SUPABASE_URL() {
    return 'https://proj.supabase.co'
  },
  get SUPABASE_PUBLISHABLE_KEY() {
    return publishableKey
  },
}))
vi.mock('@/core/supabase', () => ({
  supabase: { auth: { getSession: () => getSession() }, from: (t: string) => from(t) },
}))
// runner-url seam (RUNNER_URL default used when input omits runnerUrl)
vi.mock('@/core/runner', () => ({ RUNNER_URL: 'https://runner.test' }))

import {
  bakedIframeSrc,
  mintInitPayload,
  pickAppNodeMode,
  resolveAppNode,
  resolveMaterializedMount,
} from '@/core/childMount'
import { resolveAgentStudioRuntime } from '@/core/runtime'

function makeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`
}

beforeEach(() => {
  publishableKey = ANON_JWT
  getSession.mockResolvedValue({ data: { session: { access_token: 'fresh-user-jwt' } } })
})
afterEach(() => vi.clearAllMocks())

describe('pickAppNodeMode (generic, not slug-hardcoded)', () => {
  it('materialized flag + materialization_source → materialized', () => {
    const r = pickAppNodeMode({ materialization_source: { upstream_repo: 'r' } }, 'materialized', 'app')
    expect(r.mode).toBe('materialized')
  })
  it('materialized flag but only legacy path → CUTOVER falls back to baked (no stranding)', () => {
    const r = pickAppNodeMode({ internal_mount_path: '/internal/app/' }, 'materialized', 'app')
    expect(r.mode).toBe('baked')
    expect(r.bakedMountPath).toBe('/internal/app/')
  })
  it('baked flag + internal_mount_path → baked (legacy wins even if source present)', () => {
    const r = pickAppNodeMode(
      { internal_mount_path: '/internal/x/', materialization_source: { upstream_repo: 'r' } },
      'baked',
      'x',
    )
    expect(r.mode).toBe('baked')
  })
  it('baked flag defaults the path to /internal/{slug}/ when overlay path is empty string', () => {
    const r = pickAppNodeMode({ internal_mount_path: '' }, 'baked', 'studio')
    expect(r.mode).toBe('baked')
    expect(r.bakedMountPath).toBe('/internal/studio/')
  })
  it('no usable overlay → misconfigured', () => {
    expect(pickAppNodeMode({}, 'baked', 'x').mode).toBe('misconfigured')
    expect(pickAppNodeMode(null, 'materialized', 'x').mode).toBe('misconfigured')
  })
})

describe('resolveAppNode', () => {
  it('returns null (→ no-such-app) when no row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await resolveAppNode('ghost', 'baked')).toBeNull()
  })
  it('returns null on Supabase error', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await resolveAppNode('x', 'baked')).toBeNull()
  })
  it('queries kind=app + slug and resolves the mode', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'n1', slug: 'studio', config_overlay: { internal_mount_path: '/internal/studio/' } },
      error: null,
    })
    const r = await resolveAppNode('studio', 'baked')
    expect(from).toHaveBeenCalledWith('nodes')
    expect(eq1).toHaveBeenCalledWith('slug', 'studio')
    expect(eq2).toHaveBeenCalledWith('kind', 'app')
    expect(r?.mode).toBe('baked')
    expect(r?.node.id).toBe('n1')
  })
})

describe('mintInitPayload — L1 key contract', () => {
  it('carries the FRESH user JWT + publishable (anon) key; version 1; never service_role', async () => {
    const p = await mintInitPayload({ mountId: 'n1', hostLanguage: 'de', runnerServiceUrl: 'https://runner.test' })
    expect(p).not.toBeNull()
    expect(p!.type).toBe('AOS_INIT')
    expect(p!.version).toBe(1)
    expect(p!.platformJwt).toBe('fresh-user-jwt')
    expect(p!.supabasePublishableKey).toBe(ANON_JWT)
    expect(p!.supabaseUrl).toBe('https://proj.supabase.co')
    expect(p!.hostLanguage).toBe('de')
    expect(p!.runnerServiceUrl).toBe('https://runner.test')
    // Hard guarantee: the payload never contains a service_role token.
    expect(JSON.stringify(p)).not.toContain('service_role')
  })
  it('returns null when there is no session (→ no-session)', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await mintInitPayload({ mountId: 'n1' })).toBeNull()
  })
  it('THROWS if a service_role key was wired into the publishable slot', async () => {
    publishableKey = makeJwt({ role: 'service_role' })
    await expect(mintInitPayload({ mountId: 'n1' })).rejects.toThrow(/service_role/)
  })
})

describe('resolveMaterializedMount (POST /sessions → poll /preview/status)', () => {
  const ok = (body: unknown) => ({ ok: true, json: async () => body, text: async () => '' })
  const bad = (status: number) => ({ ok: false, status, text: async () => 'err' })

  it('creates a session then returns a token-bearing URL + parsed origin on ready', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: 'sess-1' }))
      .mockResolvedValueOnce(ok({ status: 'provisioning' }))
      .mockResolvedValueOnce(ok({ status: 'ready', previewToken: 'TKN', port: 5173 }))
    const r = await resolveMaterializedMount({
      appNodeId: 'n1',
      platformJwt: 'jwt',
      runnerUrl: 'https://runner.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      previewStatusPollIntervalMs: 0,
    })
    expect(r.sessionId).toBe('sess-1')
    expect(r.previewUrl).toContain('previewToken=TKN')
    expect(r.iframeOrigin).toBe('https://runner.test')
    // First call is the POST with bearer + projectId body.
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt')
    expect(JSON.parse(init.body)).toEqual({ projectId: 'n1' })
  })
  it('throws on non-2xx session create', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(bad(403))
    await expect(
      resolveMaterializedMount({ appNodeId: 'n', platformJwt: 'j', runnerUrl: 'https://r', fetchImpl: fetchImpl as never }),
    ).rejects.toThrow(/session create failed/)
  })
  it('throws on a terminal container_dead state', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: 's' }))
      .mockResolvedValueOnce(ok({ status: 'container_dead', message: 'gone' }))
    await expect(
      resolveMaterializedMount({ appNodeId: 'n', platformJwt: 'j', runnerUrl: 'https://r', fetchImpl: fetchImpl as never }),
    ).rejects.toThrow(/terminal state/)
  })
  it('throws when ready is missing the previewToken', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: 's' }))
      .mockResolvedValueOnce(ok({ status: 'ready' }))
    await expect(
      resolveMaterializedMount({ appNodeId: 'n', platformJwt: 'j', runnerUrl: 'https://r', fetchImpl: fetchImpl as never }),
    ).rejects.toThrow(/without previewToken/)
  })
  it('throws after exhausting the poll attempts', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: 's' }))
      .mockResolvedValue(ok({ status: 'provisioning' }))
    await expect(
      resolveMaterializedMount({
        appNodeId: 'n',
        platformJwt: 'j',
        runnerUrl: 'https://r',
        fetchImpl: fetchImpl as never,
        maxPreviewStatusAttempts: 2,
        previewStatusPollIntervalMs: 0,
      }),
    ).rejects.toThrow(/did not become ready/)
  })
})

describe('resolveAgentStudioRuntime (runtime flag precedence)', () => {
  it('explicit values always win', () => {
    expect(resolveAgentStudioRuntime({ VITE_AOS_AGENT_STUDIO_RUNTIME: 'materialized' }, 'localhost')).toBe('materialized')
    expect(resolveAgentStudioRuntime({ VITE_AOS_AGENT_STUDIO_RUNTIME: 'baked' }, 'dev.bos.pro')).toBe('baked')
  })
  it('undefined flag → hosted-dev hosts default to materialized', () => {
    expect(resolveAgentStudioRuntime({}, 'dev.bos.pro')).toBe('materialized')
    expect(resolveAgentStudioRuntime({}, 'feat-x.vbp-german.pages.dev')).toBe('materialized')
  })
  it('foreign *.pages.dev does NOT trigger materialized (scoped, security)', () => {
    expect(resolveAgentStudioRuntime({}, 'evil.pages.dev')).toBe('baked')
  })
  it('defaults to baked for plain hosts when undefined', () => {
    expect(resolveAgentStudioRuntime({}, 'localhost')).toBe('baked')
  })
})

describe('bakedIframeSrc', () => {
  it('appends ?mountId= (and uses & when a query already exists)', () => {
    expect(bakedIframeSrc('/internal/x/', 'n1')).toBe('/internal/x/?mountId=n1')
    expect(bakedIframeSrc('/internal/x/?a=1', 'n1')).toBe('/internal/x/?a=1&mountId=n1')
  })
})
