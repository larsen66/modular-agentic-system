import { supabase } from './supabase'

// Runner-service client seam. The island reuses the SAME runner-service as the legacy app; this is
// the island-side recreation of the legacy `src/config/ports.ts` + `src/lib/runnerFetch.ts` (pure
// fetch/runtime logic, recreated not copied — it needs the Supabase JWT, so it lives in core/).
// Contract source: legacy `src/config/ports.ts`, `src/lib/runnerFetch.ts`.

const env = import.meta.env as Record<string, string | undefined>

function resolveRunnerUrl(): string {
  // Explicit VITE_RUNNER_URL always wins — lets local dev point directly at the remote runner
  // without going through the Vite proxy (useful when the proxy isn't started or is mis-targeted).
  const explicitOverride = env.VITE_RUNNER_URL?.trim()
  if (explicitOverride) return explicitOverride.replace(/\/+$/, '')

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location

    // Electron production: served via app:// custom protocol. No Vite dev proxy exists here.
    if (protocol === 'app:') {
      return 'https://runner.cloved.ai'
    }

    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^[\d.]+$/.test(hostname)
    // Local dev fallback: same-origin Vite proxy (`/__runner` → VITE_RUNNER_PROXY_TARGET).
    // Prefer setting VITE_RUNNER_URL to the remote runner to skip the proxy entirely.
    if (isLocal) {
      return '/__runner'
    }
    if (hostname === 'bos.pro' || hostname.endsWith('.bos.pro')) return 'https://runner.cloved.ai'
    if (hostname.endsWith('.vbp-german.pages.dev')) return 'https://rundev.cloved.ai'
  }
  // Non-local (deployed) builds may still pin the runner explicitly via VITE_RUNNER_URL.
  const override = env.VITE_RUNNER_URL?.trim()
  return override ? override.replace(/\/+$/, '') : ''
}

/** The resolved runner-service origin (no trailing slash). Used for API calls (proxied in dev). */
export const RUNNER_URL = resolveRunnerUrl()

/**
 * The DIRECT (absolute) runner URL for preview iframe `src` attributes.
 *
 * In local dev `RUNNER_URL` is a same-origin proxy path (`/__island-demo/__runner`). That proxy
 * works for XHR/fetch because it rewrites headers; but when used as an iframe src the user's app
 * assets inside the frame (e.g. `<script src="/assets/main.js">`) resolve against localhost
 * instead of rundev.cloved.ai — producing a blank page.
 *
 * This export is always the absolute origin so asset URLs inside the preview frame are correct.
 * It never passes through the Vite proxy; the runner must already accept the browser's origin via
 * CORS for the token-gated preview response (it does — the previewToken is the auth).
 */
export const PREVIEW_RUNNER_URL = (() => {
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (protocol === 'app:') {
      // Electron prod — same as RUNNER_URL (no proxy involved)
      const override = env.VITE_RUNNER_URL?.trim()
      return override ? override.replace(/\/+$/, '') : 'https://runner.cloved.ai'
    }
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^[\d.]+$/.test(hostname)
    if (isLocal) {
      // Use the proxy target directly — avoids the same-origin proxy path for iframe src.
      const target = env.VITE_RUNNER_PROXY_TARGET?.trim() || 'https://rundev.cloved.ai'
      return target.replace(/\/+$/, '')
    }
    if (hostname === 'bos.pro' || hostname.endsWith('.bos.pro')) return 'https://runner.cloved.ai'
    if (hostname.endsWith('.vbp-german.pages.dev')) return 'https://rundev.cloved.ai'
  }
  const override = env.VITE_RUNNER_URL?.trim()
  return override ? override.replace(/\/+$/, '') : ''
})()

async function authToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

const DEFAULT_TIMEOUT_MS = 30_000

export interface RunnerFetchInit extends RequestInit {
  /** Skip attaching the Supabase JWT (for anonymous endpoints). */
  skipAuth?: boolean
}

/** Error thrown by `runnerJson` on a non-2xx response, carrying the parsed body + status. */
export class RunnerError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'RunnerError'
    this.status = status
    this.body = body
  }
}

/**
 * Fetch a runner endpoint with the Supabase JWT attached. 30s timeout for normal requests; no
 * timeout for SSE (`Accept: text/event-stream`). On 401, refreshes the session once and retries.
 * Returns the raw Response (callers parse JSON or read the stream).
 */
export async function runnerFetch(path: string, init: RunnerFetchInit = {}): Promise<Response> {
  const url = path.startsWith('http')
    ? path
    : `${RUNNER_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  const isStream = (headers.get('Accept') ?? '').includes('text/event-stream')

  if (!init.skipAuth && !headers.has('Authorization')) {
    const token = await authToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let signal = init.signal ?? undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  if (!isStream) {
    const controller = new AbortController()
    timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    if (init.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    signal = controller.signal
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, signal })
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (res.status === 401 && !init.skipAuth) {
    await supabase.auth.refreshSession()
    const token = await authToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      res = await fetch(url, { ...init, headers })
    }
  }
  return res
}

/** Fetch + parse JSON; throws `RunnerError` on non-2xx (with the parsed body). */
export async function runnerJson<T>(path: string, init?: RunnerFetchInit): Promise<T> {
  const res = await runnerFetch(path, init)
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!res.ok) {
    const b = body as { message?: string; error?: string } | null
    throw new RunnerError(b?.message || b?.error || `Runner request failed (${res.status})`, res.status, body)
  }
  return body as T
}
