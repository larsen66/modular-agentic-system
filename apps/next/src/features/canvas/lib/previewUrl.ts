import { PREVIEW_RUNNER_URL } from '@/core/runner'
import type { PreviewSurface } from '@/core/preview'

// Use PREVIEW_RUNNER_URL (always absolute) — not RUNNER_URL (proxied in dev). These URLs are iframe
// src attributes; sub-resources inside the frame (JS/CSS) resolve against the URL origin, so the
// proxy path would send them to localhost instead of the actual runner. Aliased here to avoid
// touching the rest of the file.
const RUNNER_URL = PREVIEW_RUNNER_URL

// Pure preview-URL composition (canvas `preview-lifecycle` flow §3.4). Recreation of the legacy
// `buildPreviewUrl` — the cache-bust gating + cached-viewer path are load-bearing (white-blink and
// double-reload fixes). Pure + sync: the cached-viewer HEAD preflight is async and owned by the hook,
// which passes the resolved `useCachedViewer` boolean here.

export interface BuildPreviewUrlOptions {
  /** Snapshot `previewPath` (e.g. `/sessions/<sid>/preview[/<port>]`). Required — null → no URL. */
  previewPath: string | null
  /** HMAC token from `GET /preview/status`. Required — null → no URL. */
  previewToken: string | null
  /** `built.lastBuiltAt` — the `_v` cache-buster. */
  builtAt?: number | null
  /** `devRunNonce` — the `_r` cache-buster (dev run changed). */
  devRunNonce?: number | null
  /** `built.buildHash` — enables the immutable cached-viewer path (ADR 0053). */
  buildHash?: string | null
  /** Backend-selected surface. `_v` is OMITTED on `dev` (HMR owns reloads → avoids white blink). */
  selectedSurface?: PreviewSurface
  /** Resolved by the hook's HEAD preflight of `/preview-cache/<hash>/index.html` (gates 3-way). */
  useCachedViewer?: boolean
  /** Appended per-mount for surface routing. */
  hostWorkspaceId?: string | null
}

/**
 * Compose the token-bearing proxy URL, or `null` when `previewPath`/`previewToken` are missing.
 * - Cached-viewer path when `useCachedViewer` (caller already verified the 3 gates + 200 preflight):
 *   `…/preview-cache/<hash>/index.html?previewToken=…&_v=<builtAt>`.
 * - Otherwise the dev/legacy path: `<previewPath>?previewToken=…[&_v][&_r][&hostWorkspaceId]`.
 */
export function buildPreviewUrl(opts: BuildPreviewUrlOptions): string | null {
  const { previewPath, previewToken } = opts
  if (!previewPath || !previewToken) return null

  // `_v` is gated on surface: dev has HMR, so a new `_v` per built rebuild reload-races the
  // dev↔built bounce → white blink. Omit on dev. (flow §3.4 item 14)
  const includeV = opts.selectedSurface !== 'dev' && opts.builtAt != null

  if (opts.useCachedViewer && opts.buildHash) {
    const sid = extractSessionId(previewPath)
    const base = `${RUNNER_URL}/sessions/${sid}/preview-cache/${encodeURIComponent(opts.buildHash)}/index.html`
    const url = new URL(base, originBase())
    url.searchParams.set('previewToken', previewToken)
    if (includeV) url.searchParams.set('_v', String(opts.builtAt))
    if (opts.hostWorkspaceId) url.searchParams.set('hostWorkspaceId', opts.hostWorkspaceId)
    return stripOrigin(url)
  }

  const url = new URL(`${RUNNER_URL}${previewPath}`, originBase())
  url.searchParams.set('previewToken', previewToken)
  if (includeV) url.searchParams.set('_v', String(opts.builtAt))
  if (opts.devRunNonce != null) url.searchParams.set('_r', String(opts.devRunNonce))
  if (opts.hostWorkspaceId) url.searchParams.set('hostWorkspaceId', opts.hostWorkspaceId)
  return stripOrigin(url)
}

/** The immutable cached-viewer index path to HEAD-preflight (the hook checks for a 200 before commit). */
export function cachedViewerPreflightUrl(previewPath: string, buildHash: string): string {
  const sid = extractSessionId(previewPath)
  return `${RUNNER_URL}/sessions/${sid}/preview-cache/${encodeURIComponent(buildHash)}/index.html`
}

function extractSessionId(previewPath: string): string {
  const m = previewPath.match(/\/sessions\/([^/]+)\//) ?? previewPath.match(/\/sessions\/([^/?]+)/)
  return m ? m[1] : ''
}

// RUNNER_URL here is always PREVIEW_RUNNER_URL (absolute). `originBase` is kept so `new URL()`
// can parse the base in environments without `window`; `stripOrigin` always returns the full URL.
function originBase(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
}

function stripOrigin(url: URL): string {
  const isAbsoluteRunner = /^https?:\/\//.test(RUNNER_URL)
  if (isAbsoluteRunner) return url.toString()
  return `${url.pathname}${url.search}`
}
