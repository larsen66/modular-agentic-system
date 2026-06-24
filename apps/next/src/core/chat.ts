import { runnerFetch } from './runner'
import { supabase } from './supabase'
import { streamKernelMessage, setKernelPreview } from './kernel'
import { createKernelTranslator, type RunEvent } from './kernelTranslator'

// The island stream-frame type lives with the translator that produces it; re-exported here for the
// consumers (useChatRun) that import it from '@/core/chat'.
export type { RunEvent }

// Chat run + streaming seam. Island-side recreation of the legacy chat-run transport.
// Contract source: legacy `src/hooks/chat/useChatStreaming.ts`, `useMessageStream.ts`,
// `src/lib/chat/{modelSelectorState,chatRunHelpers}.ts`, `shared/chat-events.ts`; runner
// `runner-service/src/routes/chat.routes.ts`.

// ── Selection → request body (the two-switch omission contract, TC-1/TC-12) ──

export type ModelMode = 'auto' | 'explicit'
export type AgentMode = 'auto' | 'explicit'

export interface RunSelection {
  agentProfileId?: string
  depthPresetId?: string
  model?: string
  provider?: string
}

/**
 * Derive the run-selection options from the selector state. LOAD-BEARING: `auto` OMITS the key so
 * the runner falls through session_default → system_default. Never send `model: undefined`.
 */
export function buildRunSelection(input: {
  modelMode: ModelMode
  explicitModelRef: { provider: string; model: string } | null
  agentMode: AgentMode
  selectedAgentId: string | null
  effortId?: string | null
}): RunSelection {
  const out: RunSelection = {}
  if (input.agentMode === 'explicit' && input.selectedAgentId) out.agentProfileId = input.selectedAgentId
  if (input.effortId) out.depthPresetId = input.effortId
  if (input.modelMode === 'explicit' && input.explicitModelRef?.model && input.explicitModelRef?.provider) {
    out.model = input.explicitModelRef.model
    out.provider = input.explicitModelRef.provider
  }
  return out
}

export interface ChatSendBody {
  prompt: string
  correlationId: string
  idempotencyKey: string
  chatId?: string
  agentProfileId?: string
  effortId?: string
  depthPresetId?: string
  model?: string
  provider?: string
  attachments?: unknown[]
  humanOverride?: unknown
}

/** Assemble the POST /chat body with the falsy-omission gate (defense-in-depth). */
export function buildChatBody(
  prompt: string,
  selection: RunSelection,
  ids: { correlationId: string; idempotencyKey: string; chatId?: string | null },
  attachments?: unknown[],
  humanOverride?: unknown,
): ChatSendBody {
  return {
    prompt,
    correlationId: ids.correlationId,
    idempotencyKey: ids.idempotencyKey,
    ...(ids.chatId ? { chatId: ids.chatId } : {}),
    ...(selection.agentProfileId ? { agentProfileId: selection.agentProfileId } : {}),
    ...(selection.depthPresetId
      ? { effortId: selection.depthPresetId, depthPresetId: selection.depthPresetId }
      : {}),
    ...(selection.model ? { model: selection.model } : {}),
    ...(selection.provider ? { provider: selection.provider } : {}),
    ...(attachments?.length ? { attachments } : {}),
    ...(humanOverride ? { humanOverride } : {}),
  }
}

// ── Admission (POST /chat) ──

export type AdmissionResult =
  | { kind: 'accepted'; runId: string; sessionId?: string; model?: string; provider?: string }
  | { kind: 'duplicate'; runId: string; phase?: string }
  | {
      kind: 'rejected'
      code: string
      message: string
      retryAfter?: number
      activeWriterChatId?: string | null
      balanceCheck?: unknown
    }
  | { kind: 'handoff'; runId: string; handoffId?: string; handoffStatus?: string }

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

/** POST /sessions/:id/chat — submit a run for admission. */
export async function postChat(
  sessionId: string,
  body: ChatSendBody,
  runId?: string,
): Promise<AdmissionResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (runId) headers['X-Run-ID'] = runId
  const res = await runnerFetch(`/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = (await safeJson(res)) ?? {}

  if (res.status === 200 && data.duplicate) {
    return { kind: 'duplicate', runId: String(data.runId), phase: data.phase as string | undefined }
  }
  if (res.status === 202) {
    if (data.rejection_code) {
      return {
        kind: 'rejected',
        code: String(data.rejection_code),
        message: String(data.message ?? ''),
        retryAfter: data.retry_after as number | undefined,
        balanceCheck: data.balance_check,
      }
    }
    if (data.mode === 'human') {
      return {
        kind: 'handoff',
        runId: String(data.runId),
        handoffId: data.handoff_id as string | undefined,
        handoffStatus: data.handoff_status as string | undefined,
      }
    }
    return {
      kind: 'accepted',
      runId: String(data.runId),
      sessionId: data.sessionId as string | undefined,
      model: data.model as string | undefined,
      provider: data.provider as string | undefined,
    }
  }
  if (!res.ok) {
    return {
      kind: 'rejected',
      code: String(data.code ?? data.error ?? `http_${res.status}`),
      message: String(data.message ?? data.error ?? `Request failed (${res.status})`),
      retryAfter: (data.retryAfter ?? data.retry_after) as number | undefined,
      activeWriterChatId: (data.activeWriterChatId as string | null) ?? null,
    }
  }
  if (data.runId) return { kind: 'accepted', runId: String(data.runId) }
  return { kind: 'rejected', code: 'unknown', message: 'Unexpected admission response' }
}

/** Answer a guided-intake question. Kernel V1 has no interactive answer lane → no-op. */
export async function postAnswer(
  _sessionId: string,
  _requestID: string,
  _answers: string[][],
): Promise<{ runId?: string; acceptedAnswer?: unknown }> {
  return {}
}

export type PermissionAction = 'allow_once' | 'allow' | 'deny'

/** Respond to a tool-permission request. Kernel V1 has no interactive permission lane → no-op. */
export async function respondPermission(
  _sessionId: string,
  _permissionId: string,
  _action: PermissionAction,
  _opts?: { chatId?: string },
): Promise<void> {
  /* no-op */
}

/**
 * Stop the active run. The kernel cancels when the `POST /message` socket closes — which the
 * subscribeRun AbortController already does in useChatRun.stop(). There is no abort endpoint, so this
 * is a no-op kept for call-site compatibility.
 */
export async function abortRun(
  _sessionId: string,
  _opts: { runId?: string; chatId?: string; reason?: string },
): Promise<void> {
  /* no-op — cancellation is the stream abort in subscribeRun */
}

// ── Streaming transport (SSE, primary) ──

export interface RawStreamFrame {
  id: number | null
  event: string
  data: unknown
}

function parseFrame(raw: string): RawStreamFrame | null {
  let id: number | null = null
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('id:')) {
      const n = Number(line.slice(3).trim())
      if (Number.isFinite(n)) id = n
    } else if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (!dataLines.length && event === 'message') return null
  let data: unknown = null
  if (dataLines.length) {
    const joined = dataLines.join('\n')
    try {
      data = JSON.parse(joined)
    } catch {
      data = joined
    }
  }
  return { id, event, data }
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onFrame: (f: RawStreamFrame) => void,
): Promise<boolean> {
  const reader = body.getReader()
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
        const frame = parseFrame(raw)
        if (!frame) continue
        onFrame(frame)
        if (frame.event === 'close') return true
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }
  return false
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Open the run event stream (SSE) and deliver every frame to `onFrame`. Tracks the seq cursor and
 * reconnects with `since=<lastSeq>` on transport drops (max 5 attempts). Resolves when the server
 * sends `event: close` or the signal aborts. Throws on a hard 4xx (e.g. IDOR-denied / missing run).
 */
export async function openChatEventStream(
  sessionId: string,
  opts: { runId: string; since?: number; signal?: AbortSignal },
  onFrame: (f: RawStreamFrame) => void,
): Promise<void> {
  let cursor = opts.since ?? 0
  let attempts = 0
  const MAX_ATTEMPTS = 5

  while (!opts.signal?.aborted) {
    let res: Response
    try {
      res = await runnerFetch(
        `/sessions/${sessionId}/chat/events?runId=${encodeURIComponent(opts.runId)}&since=${cursor}`,
        { headers: { Accept: 'text/event-stream' }, signal: opts.signal },
      )
    } catch (err) {
      if (opts.signal?.aborted) return
      if (++attempts > MAX_ATTEMPTS) throw err
      await delay(1000)
      continue
    }

    if (res.status >= 400 && res.status < 500) {
      const data = await safeJson(res)
      throw new Error((data?.message as string) || `Stream failed (${res.status})`)
    }
    if (!res.ok || !res.body) {
      if (++attempts > MAX_ATTEMPTS) throw new Error(`Stream failed (${res.status})`)
      await delay(1000)
      continue
    }

    attempts = 0
    let closed = false
    try {
      closed = await readSse(res.body, opts.signal, (frame) => {
        if (frame.id != null) cursor = frame.id
        onFrame(frame)
      })
    } catch {
      if (opts.signal?.aborted) return
    }
    if (closed || opts.signal?.aborted) return
    // Stream ended without an explicit close → reconnect from the cursor.
    if (++attempts > MAX_ATTEMPTS) return
    await delay(1000)
  }
}

/** A v4 UUID for correlation / idempotency keys. */
export function newId(): string {
  return crypto.randomUUID()
}

// ── Durable chat history ─────────────────────────────────────────────────────
// The transcript source of truth is the Supabase `chat_messages` table (the runner persists every
// turn there); the runner SSE stream is only the LIVE lane for an in-flight run. Opening an existing
// chat reads history from here. Contract source: legacy `src/hooks/chat/useChatMessages.ts` (the
// durable read at line 293 + `mapRowToMessage`).

export interface ChatHistoryToolCall {
  tool: string
  callID?: string
  toolState?: 'running' | 'completed' | 'error'
  content?: string
  file?: string
  raw?: Record<string, unknown>
  startedAt?: number
}

export interface ChatHistoryRow {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string
  createdAt: string | null
  /** Legacy single-string reasoning. Newer runs persist `thinkingSteps` instead (see below). */
  thinkingContent?: string
  /** The reasoning stream as persisted by the runner (`metadata.thinkingSteps`) — the live thinking
   *  chunks, oldest-first. The current run pipeline writes THIS, not `thinkingContent`. */
  thinkingSteps?: { text: string; at?: number }[]
  contentChunks?: { text: string; at?: number }[]
  toolCalls?: ChatHistoryToolCall[]
}

/** Read a chat's durable transcript, oldest-first. Returns [] on any error (never throws). */
export async function fetchChatHistory(chatId: string, projectId: string): Promise<ChatHistoryRow[]> {
  if (!chatId || !projectId) return []
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('chat_id', chatId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error || !data) {
    // Surface the cause in dev — this query silently returning empty is exactly what makes a chat
    // open to the "no messages" state (RLS denial, project_id mismatch, transient error, …).
    if (import.meta.env.DEV) {
      console.warn('[fetchChatHistory] empty/error', { chatId, projectId, error })
    }
    return []
  }
  if (import.meta.env.DEV) {
    console.info('[fetchChatHistory] rows', { chatId, projectId, count: data.length })
  }

  return (data as Array<Record<string, unknown>>)
    .map((row): ChatHistoryRow | null => {
      const role = row.role as ChatHistoryRow['role']
      if (role !== 'user' && role !== 'assistant' && role !== 'system' && role !== 'error') return null
      const meta = (row.metadata ?? null) as Record<string, unknown> | null
      const toolCalls = meta && Array.isArray(meta.toolCalls) ? (meta.toolCalls as ChatHistoryToolCall[]) : undefined
      const contentChunks =
        meta && Array.isArray(meta.contentChunks)
          ? (meta.contentChunks as { text: string; at?: number }[])
          : undefined
      const thinkingContent = meta && typeof meta.thinkingContent === 'string' ? meta.thinkingContent : undefined
      const thinkingSteps =
        meta && Array.isArray(meta.thinkingSteps)
          ? (meta.thinkingSteps as { text: string; at?: number }[])
          : undefined
      return {
        id: String(row.id),
        role,
        content: typeof row.content === 'string' ? row.content : '',
        createdAt: (row.created_at as string) ?? null,
        ...(thinkingContent ? { thinkingContent } : {}),
        ...(thinkingSteps && thinkingSteps.length ? { thinkingSteps } : {}),
        ...(contentChunks && contentChunks.length ? { contentChunks } : {}),
        ...(toolCalls && toolCalls.length ? { toolCalls } : {}),
      }
    })
    .filter((r): r is ChatHistoryRow => r !== null)
}

// ── Missing exports required by consumers ─────────────────────────────────────────────────────

/** Re-export RunPhase from the canonical features/chat/types definition. */
export type { RunPhase } from '@/features/chat/types'

/** A selectable model option for the model catalog. */
export interface ModelOption {
  id: string
  provider: string
  model: string
  label: string
  description?: string
  contextLength?: number
  isPinned?: boolean
  /** Whether this model is available in the current context. */
  available?: boolean
}

/** Fetch available models from the runner. Returns empty array until endpoint exists. */
export async function fetchModelCatalog(_sessionId?: string): Promise<ModelOption[]> {
  return []
}

// ── admitAndSend — high-level send primitive used by the chat store / harness ─────────────────
// Matches the test contract: admitAndSend(sessionId, prompt, opts?) → SendResult

export interface SendOpts {
  chatId?: string
  idempotencyKey?: string
  correlationId?: string
  model?: string
  provider?: string
  /** Kernel run target — the harness×environment pair from the selector (omit → kernel defaults). */
  harness?: string
  environment?: string
  topology?: string
  /** Project this run belongs to (used by kernel run-persistence when enabled). */
  projectId?: string
  agentProfileId?: string
  depthPresetId?: string
  attachments?: unknown[]
  /** If true, don't append an optimistic user message (used when replaying queued sends). */
  skipAppend?: boolean
}

export type SendResult =
  | { kind: 'accepted'; runId: string; phase?: string; duplicate: boolean }
  | {
      kind: 'rejected'
      code: string
      message: string
      retryAfterMs?: number
      retryAfter?: number
      activeWriterChatId?: string | null
      balanceCheck?: unknown
    }
  | { kind: 'error'; code: string; message: string; status: number; fatal: boolean; retryable: boolean }

// ── Kernel run transport ──────────────────────────────────────────────────────────────────────
// The kernel combines admission + streaming into ONE `POST /message` (no separate admission lane,
// no writer-lock / balance control). So admitAndSend just stashes the run payload client-side under
// a generated runId and returns `accepted`; subscribeRun fires the actual request and translates the
// kernel's EngineEvent SSE into the island frame vocabulary both reducers already understand.

interface KernelPendingRun {
  prompt: string
  harness?: string
  environment?: string
  model?: string
  topology?: string
  projectId?: string
  chatId?: string
}
const KERNEL_PENDING = new Map<string, KernelPendingRun>()

/**
 * Send a prompt to the kernel. Admission is implicit (the run starts in subscribeRun), so we stash
 * the payload under a client-generated runId and return `accepted`. Discriminated SendResult kept for
 * call-site compatibility — rejections no longer occur (the kernel has no admission control in V1).
 */
export async function admitAndSend(
  _sessionId: string,
  prompt: string,
  opts: SendOpts = {},
): Promise<SendResult> {
  const runId = opts.idempotencyKey ?? newId()
  KERNEL_PENDING.set(runId, {
    prompt,
    harness: opts.harness,
    environment: opts.environment,
    model: opts.model,
    topology: opts.topology,
    projectId: opts.projectId,
    chatId: opts.chatId ?? undefined,
  })
  return { kind: 'accepted', runId, duplicate: false }
}

// ── subscribeRun — SSE subscription with cursor tracking ──────────────────────────────────────

/**
 * Open the run stream. Pulls the payload stashed by admitAndSend, fires `POST /message` on the
 * kernel, and translates each EngineEvent frame to island frames delivered via onEvent. Returns a
 * stop fn; calling it aborts the fetch, which closes the kernel socket and cancels the run.
 */
export function subscribeRun(args: {
  sessionId: string
  runId: string
  onEvent: (e: RunEvent) => void
  since?: number
}): () => void {
  const { sessionId, runId, onEvent } = args
  const controller = new AbortController()
  const pending = KERNEL_PENDING.get(runId)
  KERNEL_PENDING.delete(runId)
  if (!pending) {
    // No stashed payload — e.g. resubscribe after a reload. The kernel has no resumable event log in V1.
    onEvent({ eventType: 'error', data: { error: 'Run is not resumable', code: 'no_pending_run' } })
    return () => controller.abort()
  }
  // One translator per run — it carries the cross-frame state (callId→tool name, open-child stack,
  // usage accumulator) that maps the kernel's flat EngineEvent wire onto island frames.
  const translator = createKernelTranslator(sessionId, setKernelPreview)
  void (async () => {
    try {
      await streamKernelMessage(
        {
          prompt: pending.prompt,
          sessionId,
          harness: pending.harness,
          environment: pending.environment,
          model: pending.model,
          topology: pending.topology,
          projectId: pending.projectId,
          chatId: pending.chatId,
          runId,
        },
        (f) => {
          for (const e of translator.translate(f)) onEvent(e)
        },
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) return
      onEvent({ eventType: 'error', data: { error: err instanceof Error ? err.message : 'Kernel stream failed', code: 'kernel_stream' } })
    }
  })()
  return () => controller.abort()
}
