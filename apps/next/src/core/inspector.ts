// Unified run-flow inspector bus. One timeline that captures an end-to-end chat run for E2E tracing:
//
//   user (request) → run (front-end lifecycle: phases, translated frames, FINAL RESULT)
//                  → kernel (raw EngineEvents + /message request/stream boundaries) → net
//
// Producers: src/core/kernel.ts (source 'kernel'/'net'), src/features/chat/state/chatStore.ts
// (source 'user'/'run'). Consumer: the "Agent Stream" DevTools extension, which reads the
// `window.__AGENT_INSPECTOR__` bridge installed below. Everything stored is JSON-serializable.

/** Which layer a record originates from — the primary filter axis in the panel. */
export type InspectorSource = 'user' | 'run' | 'kernel' | 'net'

/** One inspector record. `event` is the specific name; `level` lets the panel flag failures. */
export interface InspectorRecord {
  /** Monotonic id, assigned in arrival order. */
  seq: number
  /** Epoch ms when captured. */
  ts: number
  source: InspectorSource
  /** Specific event name, e.g. 'request', 'phase', 'frame:tool_call', 'final_result', 'error'. */
  event: string
  level: 'info' | 'error'
  /** Decoded payload (frame data, request body, run-state patch, final text, …). */
  data: unknown
  sessionId?: string
  chatId?: string
  projectId?: string
  /** Run id when known — correlates a single user-request → final-result flow. */
  runId?: string
}

const RING_MAX = 2000
const ring: InspectorRecord[] = []
const listeners = new Set<(r: InspectorRecord) => void>()
let seq = 0

// Defensive localStorage access: some test/SSR envs define a partial `localStorage` stub without a
// usable getItem/setItem, so feature-detect the methods rather than just the global.
function lsGet(key: string): string | null {
  try {
    if (typeof localStorage?.getItem === 'function') return localStorage.getItem(key)
  } catch {
    /* access can throw under strict storage policies */
  }
  return null
}
function lsSet(key: string, value: string | null): void {
  try {
    if (!localStorage) return
    if (value == null && typeof localStorage.removeItem === 'function') localStorage.removeItem(key)
    else if (value != null && typeof localStorage.setItem === 'function') localStorage.setItem(key, value)
  } catch {
    /* best-effort persistence */
  }
}

let consoleMirror = lsGet('agent-inspector-console') === '1'

const SOURCE_STYLE: Record<InspectorSource, string> = {
  user: 'color:#38bdf8;font-weight:600',
  run: 'color:#34d399;font-weight:600',
  kernel: 'color:#a78bfa;font-weight:600',
  net: 'color:#fb923c;font-weight:600',
}

/** Emit one record onto the ring + notify subscribers (and the console, if mirroring is on). */
export function emitInspector(rec: Omit<InspectorRecord, 'seq' | 'ts' | 'level'> & { level?: 'info' | 'error' }): void {
  const full: InspectorRecord = { level: 'info', ...rec, seq: ++seq, ts: Date.now() }
  ring.push(full)
  if (ring.length > RING_MAX) ring.shift()
  if (consoleMirror) {
    const style = full.level === 'error' ? 'color:#f87171;font-weight:700' : SOURCE_STYLE[full.source]
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[${full.source} ${full.seq}] ${full.event}`, style)
    // eslint-disable-next-line no-console
    console.log(full.data)
    // eslint-disable-next-line no-console
    console.groupEnd()
  }
  for (const l of listeners) l(full)
}

/** Subscribe to every inspector record. Returns an unsubscribe fn. */
export function onInspector(cb: (r: InspectorRecord) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Snapshot of the buffered records (oldest → newest) so a panel can backfill on open. */
export function getInspectorBuffer(): InspectorRecord[] {
  return ring.slice()
}

/** Clear the ring buffer. */
export function clearInspector(): void {
  ring.length = 0
}

/** Toggle console mirroring (persisted across reloads). Returns the new state. */
export function setInspectorConsoleMirror(on: boolean): boolean {
  consoleMirror = on
  lsSet('agent-inspector-console', on ? '1' : null)
  return on
}

/** Current console-mirror state. */
export function getInspectorConsoleMirror(): boolean {
  return consoleMirror
}

// ── DevTools bridge ───────────────────────────────────────────────────────────────────────────────
// Expose the ring on `window` so the DevTools extension panel can pull records via
// `chrome.devtools.inspectedWindow.eval(...)`. The panel polls `since(cursor)` by seq, so it only
// ever transfers new records and survives panel/page re-opens.
declare global {
  interface Window {
    __AGENT_INSPECTOR__?: {
      version: number
      /** Records with seq > cursor (newest tail), capped to `limit`. */
      since: (cursor: number, limit?: number) => InspectorRecord[]
      /** Full buffered snapshot. */
      buffer: () => InspectorRecord[]
      clear: () => void
      /** Highest seq emitted so far (0 if none). */
      head: () => number
      /** Distinct event names seen — lets the panel build a sort/filter menu. */
      events: () => string[]
    }
  }
}

if (typeof window !== 'undefined') {
  window.__AGENT_INSPECTOR__ = {
    version: 2,
    since: (cursor: number, limit = 800) => {
      const out = ring.filter((r) => r.seq > cursor)
      return out.length > limit ? out.slice(out.length - limit) : out
    },
    buffer: () => ring.slice(),
    clear: () => clearInspector(),
    head: () => seq,
    events: () => Array.from(new Set(ring.map((r) => r.event))).sort(),
  }
}
