import { runnerJson, RunnerError } from './runner'

// Runs access-layer seam (canvas `diff` screen). Island-side recreation of the runner/run-enrichment
// contract — the typed operation the diff screen drives. We reuse the SAME runner-service the legacy
// app uses (via `core/runner.ts`); this is the seam, not legacy React. All runner/Supabase access for
// run data stays HERE (ARCHITECTURE §5 rule 3 — no client outside core).
//
// CONTRACT (uncertain — recreated, keep in sync as the backend lands):
//   GET /runs/:runId/diff  →  RunDiffResponse
// The legacy run-enrichment captured a per-run diff as `enrichment.diff = [{ file, additions,
// deletions, hunks? }]` (`runner-service/src/chatRunSettlement.ts`, `src/types/chat.ts`) — counts +
// pre-parsed hunks, but NO old/new file content. The `diff` screen needs old/new content so the
// `@pierre/diffs` renderer can compute line-level hunks itself (design §4, §5 row 3). This op targets
// an enrichment seam EXTENDED to carry content. Until that backend endpoint ships, the runner is
// expected to expose `GET /runs/:runId/diff` returning the shape below; if a file's content is
// unavailable (binary / too-large / not-yet-enriched) the backend sends `oldContents/newContents:
// null` and the UI renders header + ± stats only (no body). Added → `oldContents: ''`; deleted →
// `newContents: ''`.

export type RunDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export interface RunDiffFile {
  /** Post-change path (current name). For a pure rename with no edits, equals the new location. */
  path: string
  /** Previous path — present ONLY for `renamed` files. */
  prevPath?: string
  status: RunDiffFileStatus
  additions: number
  deletions: number
  /**
   * Old file text. `''` for an added file. `null` when content is unavailable (binary / too large /
   * not enriched) → the row renders header + stats only, no diff body.
   */
  oldContents: string | null
  /** New file text. `''` for a deleted file. `null` when content is unavailable (see `oldContents`). */
  newContents: string | null
}

export interface RunDiff {
  runId: string
  files: RunDiffFile[]
}

// ── Wire shape (mirror of the expected runner response; tolerant of the legacy `file` key) ──

interface RunDiffFileWire {
  path?: string
  /** Legacy enrichment used `file`; accept it as an alias for `path`. */
  file?: string
  prevPath?: string | null
  oldPath?: string | null
  status?: string
  additions?: number | null
  deletions?: number | null
  oldContents?: string | null
  newContents?: string | null
}

interface RunDiffResponse {
  runId?: string
  files?: RunDiffFileWire[] | null
  /** Legacy enrichment carried the array under `diff`; accept it as an alias for `files`. */
  diff?: RunDiffFileWire[] | null
}

const VALID_STATUS: ReadonlySet<RunDiffFileStatus> = new Set([
  'added',
  'modified',
  'deleted',
  'renamed',
])

function normalizeStatus(raw: string | undefined, prevPath: string | undefined): RunDiffFileStatus {
  const s = (raw ?? '').toLowerCase()
  if (VALID_STATUS.has(s as RunDiffFileStatus)) return s as RunDiffFileStatus
  // Tolerate git-style single letters / common aliases.
  if (s === 'a' || s === 'new' || s === 'create' || s === 'created') return 'added'
  if (s === 'd' || s === 'delete' || s === 'deleted' || s === 'removed') return 'deleted'
  if (s === 'r' || s === 'rename' || s === 'moved' || prevPath) return 'renamed'
  return 'modified'
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function normalizeFile(w: RunDiffFileWire): RunDiffFile {
  const prevPath = w.prevPath ?? w.oldPath ?? undefined
  const status = normalizeStatus(w.status, prevPath ?? undefined)
  return {
    path: w.path ?? w.file ?? '',
    prevPath: status === 'renamed' ? (prevPath ?? undefined) : undefined,
    status,
    additions: num(w.additions),
    deletions: num(w.deletions),
    // For added/deleted the backend may omit the empty side; coerce to '' so the renderer treats it
    // as present-but-empty (a real add/delete) rather than content-unavailable (null).
    oldContents: w.oldContents === undefined ? (status === 'added' ? '' : null) : w.oldContents,
    newContents: w.newContents === undefined ? (status === 'deleted' ? '' : null) : w.newContents,
  }
}

/**
 * Fetch the line-level file diff a single run produced. `GET /runs/:runId/diff`.
 * Throws `RunnerError` on non-2xx (caller renders the error state + retry). An empty `files` array is
 * a valid, honest result — the run made no file changes (the screen renders the "no changes" state).
 */
export async function getRunDiff(runId: string, signal?: AbortSignal): Promise<RunDiff> {
  const body = await runnerJson<RunDiffResponse>(`/runs/${encodeURIComponent(runId)}/diff`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  const wire = body.files ?? body.diff ?? []
  return {
    runId: body.runId ?? runId,
    files: Array.isArray(wire) ? wire.map(normalizeFile) : [],
  }
}

export { RunnerError }
