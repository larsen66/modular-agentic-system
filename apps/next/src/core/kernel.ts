import { supabase } from './supabase'
import { emitInspector } from './inspector'

// Kernel client seam — the RUN-EXECUTION lane of the island, pointed at the custom TS kernel
// (Fastify) instead of the legacy runner-service. Sibling of core/runner.ts: same JWT-attach
// pattern, but a different backend and a different contract.
//
//   - dev (localhost):  `/__kernel/*`  → Vite proxy → http://localhost:3000 (VITE_KERNEL_PROXY_TARGET)
//   - deployed:         same-origin     → host rewrites /message,/registry,/preview → kernel VM
//   - explicit pin:     VITE_KERNEL_URL → that origin verbatim
//
// The kernel exposes: GET /registry (harness×environment listings + defaults) and POST /message
// (admission + EngineEvent SSE in one response). It is stateless: the sessionId rides in the body
// and is scoped to the authed owner; there is no /sessions lifecycle and no abort endpoint
// (cancellation = closing the POST socket).

const env = import.meta.env as Record<string, string | undefined>

function resolveKernelUrl(): string {
  const explicit = env.VITE_KERNEL_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^[\d.]+$/.test(hostname)
    if (isLocal) return '/__kernel'
  }
  // Deployed: same-origin. The host (Vercel rewrites / kernel SPA fallback) routes the API paths.
  return ''
}

/** Resolved kernel origin (no trailing slash). '' → same-origin. '/__kernel' → dev proxy. */
export const KERNEL_URL = resolveKernelUrl()

async function authToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Fetch a kernel endpoint with the Supabase JWT attached. Refreshes once + retries on 401. */
export async function kernelFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${KERNEL_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) {
    const token = await authToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  let res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    await supabase.auth.refreshSession()
    const token = await authToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      res = await fetch(url, { ...init, headers })
    }
  }
  return res
}

// ── Registry (drives the harness×environment selector) ──────────────────────────────────────────

export interface KernelRegistryDefaults {
  harness: string
  environment: string
  reason?: string
  hasApiKey?: boolean
}

export interface KernelRegistry {
  harnesses: string[]
  environments: string[]
  /** Verified-ready 'harness x environment' pairs (highlight compatible counterparts). */
  readyPairs?: string[]
  /** Topology matrix: per-harness supported topologies + per-env hostsAgentRuntime. */
  topologyMatrix?: unknown
  /** Zero-config recommendation the selector pre-selects. */
  defaults?: KernelRegistryDefaults
  /** Main-agent profile a run defaults to when harness is omitted. */
  profile?: { harness?: string; environment?: string; model?: string }
}

/** GET /registry — the two listings + defaults for the selector dropdowns. */
export async function fetchRegistry(): Promise<KernelRegistry> {
  const res = await kernelFetch('/registry', { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`registry failed (${res.status})`)
  return res.json() as Promise<KernelRegistry>
}

// ── Run stream (POST /message → EngineEvent SSE) ─────────────────────────────────────────────────

export interface KernelRunBody {
  prompt: string
  sessionId: string
  harness?: string
  environment?: string
  model?: string
  topology?: string
  projectId?: string
  chatId?: string
  /** Client-generated run id, threaded for inspector correlation (backend may ignore it). */
  runId?: string
}

/** One parsed SSE frame from the kernel: `event:` name + decoded `data:` payload. */
export interface KernelFrame {
  event: string
  data: unknown
}

/**
 * POST /message and stream the EngineEvent SSE, delivering each parsed frame to `onFrame`. Resolves
 * when the kernel ends the response (after the `settled` frame) or the signal aborts. Throws on a
 * non-2xx open (the caller surfaces it as a run error).
 */
export async function streamKernelMessage(
  body: KernelRunBody,
  onFrame: (f: KernelFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const inspCtx = { source: 'kernel' as const, sessionId: body.sessionId, chatId: body.chatId, projectId: body.projectId, runId: body.runId }
  emitInspector({ ...inspCtx, source: 'net', event: 'POST /message', data: body })
  let res: Response
  try {
    res = await kernelFetch('/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    emitInspector({ ...inspCtx, event: 'error', level: 'error', data: { message: err instanceof Error ? err.message : String(err) } })
    throw err
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    emitInspector({ ...inspCtx, event: 'error', level: 'error', data: { status: res.status, body: text } })
    throw new Error(`kernel run failed (${res.status})${text ? `: ${text}` : ''}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        let event = 'message'
        const dataLines: string[] = []
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (!dataLines.length) continue
        const joined = dataLines.join('\n')
        let data: unknown
        try {
          data = JSON.parse(joined)
        } catch {
          data = joined
        }
        emitInspector({ ...inspCtx, event, data })
        onFrame({ event, data })
      }
    }
  } finally {
    emitInspector({ ...inspCtx, event: 'stream_end', data: { aborted: signal?.aborted ?? false } })
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }
}

// ── Preview bus ──────────────────────────────────────────────────────────────────────────────────
// The kernel emits `preview_ready { url }` inline on the run stream (it has no preview-snapshot
// lifecycle like the legacy runner). We stash the latest URL per session so a preview pane can show
// it; the chat translation layer calls setKernelPreview when the frame arrives.

const previewUrls = new Map<string, string>()
const previewListeners = new Set<(sessionId: string, url: string) => void>()

export function setKernelPreview(sessionId: string, url: string): void {
  previewUrls.set(sessionId, url)
  for (const l of previewListeners) l(sessionId, url)
}

export function getKernelPreview(sessionId: string): string | undefined {
  return previewUrls.get(sessionId)
}

export function onKernelPreview(cb: (sessionId: string, url: string) => void): () => void {
  previewListeners.add(cb)
  return () => {
    previewListeners.delete(cb)
  }
}
