import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@core/integrations/supabase/client'
import { supabase } from './supabase'
import { RUNNER_URL } from './runner'
import type { AgentStudioRuntime } from './runtime'

// Access-layer seam (Constitution v1.3.0 Principle X) — embedded L1 internal-tool (Agent Studio)
// mount resolution + the `AOS_INIT` handshake payload mint. Island recreation of legacy
// `src/components/platform/{L1ChildAppMount.tsx, materializedMountResolver.ts}`. We reuse the SAME
// runner-service + Supabase contracts as the legacy app; this is the seam, not legacy React.
//
// CORE-INTERNAL secrets boundary (legacy §7, the L1 security contract): the ONLY key that crosses the
// child frame is the **publishable/anon** key, alongside the user's Supabase access token. The
// service_role key NEVER enters this module, the payload, or the frame. `mintInitPayload` asserts it.
//
// Contract source (keep in sync): legacy `materializedMountResolver.ts` (the POST/poll shape),
// `agentStudioRuntime.ts` (the flag), `L1ChildAppMount.tsx:152-338` (mode pick + payload), and runner
// `runner-service/src/routes/sessions.routes.ts` + `preview.routes.ts` (the endpoints).

// ── Constants (carry from legacy §6) ──
export const PROTOCOL_VERSION = 1 as const
export const INIT_ACK_TIMEOUT_MS = 5_000
export const MAX_INIT_ATTEMPTS = 3
const DEFAULT_MAX_PREVIEW_STATUS_ATTEMPTS = 40
const DEFAULT_PREVIEW_STATUS_POLL_INTERVAL_MS = 1_500

/** The host origin used as `iframeOrigin` for baked (same-origin) mounts + the `hostOrigin` field. */
export const HOST_ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

// ── App-node resolution (Supabase `nodes` read) ──

/** Materialized-branch overlay source (legacy: `config_overlay.materialization_source`). */
export interface MaterializationSource {
  upstream_repo?: string
  upstream_commit?: string
  synced_at?: string
}

/** The `config_overlay` shape this module reads (only the two fields the mode pick needs). */
export interface AppNodeOverlay {
  internal_mount_path?: string | null
  materialization_source?: MaterializationSource | null
}

export interface AppNode {
  id: string
  slug: string
  config_overlay: AppNodeOverlay | null
}

export type AppNodeMode = 'baked' | 'materialized' | 'misconfigured'

export interface ResolvedAppNode {
  mode: AppNodeMode
  node: AppNode
  /** Baked src (`/internal/{slug}/`) resolved here when mode==='baked'; null otherwise. */
  bakedMountPath: string | null
  /** Reason, when mode==='misconfigured' (surfaced to the user). */
  reason?: string
}

/**
 * Decide baked vs materialized vs misconfigured from the overlay shape + the runtime flag. GENERIC by
 * overlay shape (legacy §7, Q1 2026-05-25) — NEVER slug-hardcoded; future L1 apps opt in via overlay.
 *
 * - `materialized` flag: `materialization_source` present → materialized; else `internal_mount_path`
 *   present → baked (**cutover safety net** — migration hasn't reached this row, don't strand the
 *   user mid-migration); else misconfigured.
 * - `baked` flag: `internal_mount_path` present → baked (legacy wins even if a source is also set —
 *   transitional cutover); else misconfigured.
 */
export function pickAppNodeMode(
  overlay: AppNodeOverlay | null,
  runtime: AgentStudioRuntime,
  slug: string,
): { mode: AppNodeMode; bakedMountPath: string | null; reason?: string } {
  const internalPath = overlay?.internal_mount_path?.trim() || null
  const hasSource = Boolean(overlay?.materialization_source)
  const bakedDefault = `/internal/${slug}/`

  if (runtime === 'materialized') {
    if (hasSource) return { mode: 'materialized', bakedMountPath: null }
    if (internalPath || overlay?.internal_mount_path === '') {
      // Cutover safety net: only a legacy path → fall back to baked.
      return { mode: 'baked', bakedMountPath: internalPath ?? bakedDefault }
    }
    return { mode: 'misconfigured', bakedMountPath: null, reason: 'no_materialization_source' }
  }
  // runtime === 'baked'
  if (internalPath || overlay?.internal_mount_path === '') {
    return { mode: 'baked', bakedMountPath: internalPath ?? bakedDefault }
  }
  if (hasSource) {
    // Flag says baked but only a source exists — no baked artifact path to load.
    return { mode: 'misconfigured', bakedMountPath: null, reason: 'no_internal_mount_path' }
  }
  return { mode: 'misconfigured', bakedMountPath: null, reason: 'no_usable_overlay' }
}

/**
 * Resolve the app node for `slug` (`nodes` row, `kind='app'`) and pick its mount mode. Returns `null`
 * when no row exists or Supabase errors → the caller renders `no-such-app`.
 */
export async function resolveAppNode(
  slug: string,
  runtime: AgentStudioRuntime,
): Promise<ResolvedAppNode | null> {
  const { data, error } = await supabase
    .from('nodes')
    .select('id, slug, config_overlay')
    .eq('slug', slug)
    .eq('kind', 'app')
    .maybeSingle()

  if (error || !data) {
    if (error) console.warn('[childMount] resolveAppNode failed', error.message)
    return null
  }
  const node = data as unknown as AppNode
  const { mode, bakedMountPath, reason } = pickAppNodeMode(node.config_overlay, runtime, slug)
  return { mode, node, bakedMountPath, reason }
}

// ── Materialized mount resolution (runner POST /sessions → poll /preview/status) ──

export interface ResolveMaterializedMountInput {
  appNodeId: string
  /** The user's fresh Supabase access token (Authorization bearer). */
  platformJwt: string
  runnerUrl?: string
  /** Test override; defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  maxPreviewStatusAttempts?: number
  previewStatusPollIntervalMs?: number
  signal?: AbortSignal
}

export interface MaterializedMount {
  /** Absolute, token-bearing preview URL the iframe loads. */
  previewUrl: string
  sessionId: string
  /** Origin parsed from `previewUrl` — the cross-origin `targetOrigin` + expected ACK `event.origin`. */
  iframeOrigin: string
}

interface SessionCreateResponse {
  id?: string
  sessionId?: string
}
interface PreviewStatusBody {
  status?: string
  sessionId?: string
  id?: string
  port?: number
  previewUrl?: string
  previewToken?: string
  message?: string
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const trimSlash = (u: string) => u.replace(/\/+$/, '')

function buildMaterializedUrl(args: {
  base: string
  sessionId: string
  previewUrl?: string
  port?: number
  previewToken: string
}): string {
  const raw =
    args.previewUrl ||
    (typeof args.port === 'number'
      ? `${args.base}/sessions/${encodeURIComponent(args.sessionId)}/preview/${args.port}/`
      : `${args.base}/sessions/${encodeURIComponent(args.sessionId)}/preview/`)
  const url = new URL(raw, `${args.base}/`)
  url.searchParams.set('previewToken', args.previewToken)
  return url.toString()
}

/**
 * Attach (or create) a runner session for a materialized L1 app node, poll preview readiness, and
 * return the absolute token-bearing preview URL + its origin. **Throws** on any non-2xx, terminal
 * preview state (`container_dead`/`unavailable`), a `ready` response missing a `previewToken`, or
 * poll exhaustion. CONTRACT: legacy `materializedMountResolver.ts` — `POST /sessions {projectId}` then
 * poll `GET /sessions/:id/preview/status` (40 × 1500ms). We pass the bearer explicitly (the resolver
 * may run with a freshly-read token), so we use the injected `fetchImpl`, not the JWT-attaching
 * `runnerFetch` — matching the legacy contract exactly.
 */
export async function resolveMaterializedMount(
  input: ResolveMaterializedMountInput,
): Promise<MaterializedMount> {
  const fetchImpl = input.fetchImpl ?? fetch
  const base = trimSlash(input.runnerUrl ?? RUNNER_URL)
  const auth = { Authorization: `Bearer ${input.platformJwt}` }

  const createRes = await fetchImpl(`${base}/sessions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: input.appNodeId }),
    signal: input.signal,
  })
  if (!createRes.ok) {
    throw new Error(`runner session create failed: ${createRes.status} ${await safeText(createRes)}`)
  }
  const created = (await createRes.json().catch(() => null)) as SessionCreateResponse | null
  const createdSessionId =
    (typeof created?.id === 'string' && created.id) ||
    (typeof created?.sessionId === 'string' && created.sessionId) ||
    null
  if (!createdSessionId) {
    throw new Error(`runner session create returned malformed payload: ${JSON.stringify(created)}`)
  }

  const maxAttempts = Math.max(1, input.maxPreviewStatusAttempts ?? DEFAULT_MAX_PREVIEW_STATUS_ATTEMPTS)
  const interval = Math.max(0, input.previewStatusPollIntervalMs ?? DEFAULT_PREVIEW_STATUS_POLL_INTERVAL_MS)
  let last: PreviewStatusBody | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sid = last?.sessionId ?? last?.id ?? createdSessionId
    const statusRes = await fetchImpl(
      `${base}/sessions/${encodeURIComponent(sid)}/preview/status`,
      { method: 'GET', headers: auth, signal: input.signal },
    )
    if (!statusRes.ok) {
      throw new Error(`runner preview status failed: ${statusRes.status} ${await safeText(statusRes)}`)
    }
    const body = ((await statusRes.json().catch(() => ({}))) ?? {}) as PreviewStatusBody
    last = body
    const resolvedSid = (typeof body.sessionId === 'string' && body.sessionId) ||
      (typeof body.id === 'string' && body.id) || sid

    if (body.status === 'ready') {
      if (typeof body.previewToken !== 'string' || !body.previewToken) {
        throw new Error(`runner preview ready without previewToken: ${JSON.stringify(body)}`)
      }
      const previewUrl = buildMaterializedUrl({
        base,
        sessionId: resolvedSid,
        previewUrl: typeof body.previewUrl === 'string' ? body.previewUrl : undefined,
        port: typeof body.port === 'number' ? body.port : undefined,
        previewToken: body.previewToken,
      })
      return { previewUrl, sessionId: resolvedSid, iframeOrigin: new URL(previewUrl).origin }
    }
    if (body.status === 'container_dead' || body.status === 'unavailable') {
      throw new Error(`runner preview terminal state: ${body.message || body.error || body.status}`)
    }
    if (attempt + 1 < maxAttempts) await sleep(interval)
  }
  throw new Error(
    `runner preview did not become ready after ${maxAttempts} attempts: ${last?.status ?? 'unknown'}`,
  )
}

async function safeText(res: Response): Promise<string> {
  return res.text().catch(() => '<no body>')
}

// ── AOS_INIT payload mint (the L1 key contract) ──

/** The `AOS_INIT` payload (host → iframe). Version 1. See `aosHandshake` in the feature flow. */
export interface AosInitPayload {
  type: 'AOS_INIT'
  version: typeof PROTOCOL_VERSION
  /** The user's Supabase access token (read fresh per attempt). */
  platformJwt: string
  supabaseUrl: string
  /** The anon/publishable key — the ONLY key crossing the frame. NEVER service_role. */
  supabasePublishableKey: string
  mountId: string
  hostOrigin: string
  runnerServiceUrl?: string
  hostLanguage?: string
}

export interface MintInitPayloadInput {
  mountId: string
  hostLanguage?: string
  /** Provided for materialized mounts so the child can reach the runner; omitted for baked. */
  runnerServiceUrl?: string
}

/**
 * Mint the `AOS_INIT` payload with a **fresh** access token read from the current Supabase session
 * (the token may rotate between retries — legacy §7, load-bearing). Sources `supabaseUrl` +
 * `supabasePublishableKey` (anon) from the single shared client config. Returns `null` when there is
 * no session (→ caller transitions to `no-session`).
 *
 * SECURITY: asserts the publishable key is not, in fact, a service_role key — the service_role key
 * must NEVER cross the frame (legacy §7 L1 contract).
 */
export async function mintInitPayload(input: MintInitPayloadInput): Promise<AosInitPayload | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null

  assertNotServiceRole(SUPABASE_PUBLISHABLE_KEY)

  const payload: AosInitPayload = {
    type: 'AOS_INIT',
    version: PROTOCOL_VERSION,
    platformJwt: token,
    supabaseUrl: SUPABASE_URL,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
    mountId: input.mountId,
    hostOrigin: HOST_ORIGIN,
  }
  if (input.runnerServiceUrl) payload.runnerServiceUrl = input.runnerServiceUrl
  if (input.hostLanguage) payload.hostLanguage = input.hostLanguage
  return payload
}

/**
 * Defense-in-depth: a Supabase JWT carries a `role` claim. A service_role key decodes to
 * `role: 'service_role'`. The publishable/anon key decodes to `role: 'anon'`. Throw if a
 * service_role key was ever wired into the publishable slot — it must never reach the frame.
 * CONTRACT: assumes the JWT-shaped legacy/anon publishable key format (decodable middle segment).
 * Newer `sb_publishable_…` opaque keys are not JWTs and simply skip the check (no role to leak).
 */
function assertNotServiceRole(key: string): void {
  const parts = key?.split('.')
  if (!parts || parts.length !== 3) return // opaque (sb_publishable_…) — not a JWT, nothing to decode
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { role?: string }
    if (claims.role === 'service_role') {
      throw new Error('L1 contract violation: service_role key must never cross the child frame')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('L1 contract violation')) throw err
    // Undecodable middle segment → not a recognizable JWT; nothing to assert.
  }
}

/** Build the baked-mount iframe src (same-origin `/internal/{slug}/`, `?mountId=` appended). */
export function bakedIframeSrc(bakedMountPath: string, mountId: string): string {
  const sep = bakedMountPath.includes('?') ? '&' : '?'
  return `${bakedMountPath}${sep}mountId=${encodeURIComponent(mountId)}`
}
