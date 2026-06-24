import { runnerFetch, runnerJson, RunnerError } from './runner'

// Workspace-file access-layer seam (canvas `file-reader` screen). Island-side recreation of the
// runner file read/write contract the legacy `FileContentView.tsx` drives directly. We reuse the
// SAME runner-service endpoints as the legacy app via `core/runner.ts`; this is the seam, not the
// legacy React.
//
// Contract source (keep in sync): legacy `src/pages/ux2/FileContentView.tsx` (:161 write, :207 read)
// + `runner-service/src/routes/workspace.routes.ts` (`GET /sessions/:id/file`, `POST
// /sessions/:id/files`). Live `file_changed` events arrive on the session event stream (see
// `subscribeFileChanges` below).

// ── Tree ──

export interface FileTreeResult {
  files: string[]
  truncated: boolean
}

/**
 * Fetch the flat file-path list for a project's runner workspace.
 * `GET /sessions/:id/tree?rootId=app:${projectId}&limit=10000`.
 * Mirrors the legacy `UX2FilesContext.tsx:203` call. Throws `RunnerError` on non-2xx.
 */
export async function fetchSessionFileTree(
  sessionId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<FileTreeResult> {
  const url =
    `/sessions/${encodeURIComponent(sessionId)}/tree` +
    `?rootId=${encodeURIComponent(`app:${projectId}`)}&limit=10000`
  const body = await runnerJson<{ files?: unknown; tree?: unknown; truncated?: unknown }>(url, { signal })
  const files: string[] =
    Array.isArray(body?.files) ? (body.files as string[])
    : Array.isArray(body?.tree) ? (body.tree as string[])
    : []
  return { files, truncated: Boolean(body?.truncated) }
}

// ── Read ──

export interface ReadFileArgs {
  sessionId: string
  rootId: string
  path: string
}

export interface FileContent {
  /** File body as UTF-8 text. Empty string for an empty file. */
  content: string
}

/**
 * Read one workspace file. `GET /sessions/:id/file?rootId=&path=`.
 * Returns `{ content }` (content `''` for an empty file). Throws `RunnerError` (status + parsed
 * body) on a non-2xx so the caller can render the read-error state.
 *
 * CONTRACT: response body shape is `{ content: string }` (legacy `FileContentView.tsx:222` reads
 * `body.content`). A non-string `content` is normalised to `''`.
 */
export async function readFile(args: ReadFileArgs, signal?: AbortSignal): Promise<FileContent> {
  const { sessionId, rootId, path } = args
  const url =
    `/sessions/${encodeURIComponent(sessionId)}/file` +
    `?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(path)}`
  const body = await runnerJson<{ content?: unknown }>(url, {
    headers: { Accept: 'application/json' },
    signal,
  })
  return { content: typeof body?.content === 'string' ? body.content : '' }
}

// ── Write ──

export interface WriteFileEntry {
  path: string
  content: string
  rootId: string
}

export interface WriteFilesArgs {
  sessionId: string
  files: WriteFileEntry[]
}

export type WriteFilesResult = { ok: true } | { ok: false; error: string; status?: number }

/**
 * Write one or more workspace files. `POST /sessions/:id/files` with `{ files: [{ path, content,
 * rootId }] }` (legacy `FileContentView.tsx:161`). Returns a structured `{ ok }` result rather than
 * throwing so the screen can render an inline save-error Alert without a try/catch in the component.
 *
 * Only `app:*` roots are writable; a `repo:*` write is a guaranteed backend rejection (the screen
 * gates the Edit affordance accordingly — `file-reader.md §4 writability rule`).
 */
export async function writeFiles(args: WriteFilesArgs): Promise<WriteFilesResult> {
  try {
    const res = await runnerFetch(`/sessions/${encodeURIComponent(args.sessionId)}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: args.files }),
    })
    if (res.ok) return { ok: true }
    const text = await res.text()
    let msg = `Save failed (${res.status})`
    if (text) {
      try {
        const b = JSON.parse(text) as { error?: string; message?: string }
        msg = b?.error || b?.message || msg
      } catch {
        /* non-JSON body */
      }
    }
    return { ok: false, error: msg, status: res.status }
  } catch (err) {
    const message = err instanceof RunnerError ? err.message : (err as Error)?.message
    return { ok: false, error: message || 'Network error' }
  }
}

// ── Live refresh (file_changed) ──

export interface FileChangedEvent {
  type: 'file_changed'
  path: string
}

/**
 * Subscribe to `file_changed` events for a session, invoking `onChange(path)` for each one. Island-
 * side recreation of the legacy `subscribeSessionRealtimeEvents` consumer (`FileContentView.tsx:
 * 185-193`) filtered to `file_changed`. Returns an unsubscribe fn.
 *
 * CONTRACT: the session event stream is `GET /sessions/:id/events` (SSE) carrying frames whose
 * `data` is `{ type, ... }`; a `file_changed` frame carries `data.path` (legacy reads
 * `event.data.path`). Until the dedicated session-events stream is wired island-side this opens the
 * SSE channel directly and parses frames; if the channel is unavailable it fails silent (the screen
 * still works without live refresh — manual reload via path remount covers it).
 */
export function subscribeFileChanges(
  sessionId: string,
  onChange: (path: string) => void,
): () => void {
  const controller = new AbortController()
  let stopped = false

  void (async () => {
    let res: Response
    try {
      res = await runnerFetch(`/sessions/${encodeURIComponent(sessionId)}/events`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      })
    } catch {
      return // channel unavailable → no live refresh (fail-open)
    }
    if (!res.ok || !res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      for (;;) {
        if (stopped) break
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const evt = parseFileChanged(raw)
          if (evt) onChange(evt.path)
        }
      }
    } catch {
      /* transport drop → stop (caller may resubscribe on remount) */
    } finally {
      try {
        reader.releaseLock()
      } catch {
        /* noop */
      }
    }
  })()

  return () => {
    stopped = true
    controller.abort()
  }
}

/** Parse one SSE frame; return a `file_changed` event with its `path`, else `null`. */
function parseFileChanged(raw: string): FileChangedEvent | null {
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  let data: unknown
  try {
    data = JSON.parse(dataLines.join('\n'))
  } catch {
    return null
  }
  const d = data as { type?: string; path?: string; data?: { path?: string } } | null
  if (!d || d.type !== 'file_changed') return null
  const path = d.path ?? d.data?.path
  return typeof path === 'string' ? { type: 'file_changed', path } : null
}
