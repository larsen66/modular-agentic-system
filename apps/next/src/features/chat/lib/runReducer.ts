// Pure run reducer — the SINGLE writer of run `phase` + `isStreaming` + message accumulation, as
// specified by docs/design/chat/flows/run-lifecycle.md §3. Maps the `@shared/chat-events` stream
// (delivered as `RunStreamEvent` by `core/chat.subscribeRun`) onto the island `RunState`.
//
// Reinvents the legacy useMessageStream + useMessageDedup internals (NOT a port): one place owns
// the terminal flip; `version`-guarded snapshots prevent stale-event regressions. Pure +
// deterministic → fully unit-testable.


import type { ChatMessage, RunPhase, RunState, RunStreamEvent, TodoView, ToolCallView } from '../types'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Normalize one tool-call record off a progress payload (field names mirror legacy toolCalls[]). */
function toToolCall(raw: Record<string, unknown>): ToolCallView | null {
  const callID = str(raw.callID) ?? str(raw.id)
  const tool = str(raw.tool) ?? str(raw.toolName) ?? str(raw.name)
  if (!callID || !tool) return null
  const stateRaw = str(raw.toolState) ?? str(raw.state)
  const toolState: ToolCallView['toolState'] = stateRaw === 'completed' || stateRaw === 'error' ? stateRaw : 'running'
  const del = str(raw.delegationState)
  return {
    callID, tool, toolState,
    file: str(raw.file) ?? str(raw.filePath) ?? str(raw.path),
    content: str(raw.content) ?? str(raw._output),
    delegationState: del === 'attempt' || del === 'child_session' || del === 'failed_attempt' ? del : undefined,
  }
}

/** Upsert tool calls by callID onto an existing ordered list (running→terminal transitions). */
function mergeToolCalls(existing: ToolCallView[] | undefined, incoming: ToolCallView[]): ToolCallView[] {
  const out = existing ? existing.slice() : []
  for (const tc of incoming) {
    const i = out.findIndex((e) => e.callID === tc.callID)
    if (i === -1) out.push(tc)
    else out[i] = { ...out[i], ...tc }
  }
  return out
}

/** Pull tool calls out of a progress payload (snapshot array OR a single inline tool). */
function toolCallsFrom(d: Record<string, unknown>): ToolCallView[] {
  if (Array.isArray(d.toolCalls)) {
    return d.toolCalls.map((x) => (x && typeof x === 'object' ? toToolCall(x as Record<string, unknown>) : null)).filter((x): x is ToolCallView => x !== null)
  }
  const single = toToolCall(d)
  return single ? [single] : []
}

function todosFrom(d: Record<string, unknown>): TodoView[] | undefined {
  const raw = Array.isArray(d.todoItems) ? d.todoItems : Array.isArray(d.todos) ? d.todos : null
  if (!raw) return undefined
  const items = raw
    .map((e): TodoView | null => {
      if (!e || typeof e !== 'object' || typeof (e as { content?: unknown }).content !== 'string') return null
      const s = (e as { status?: unknown }).status
      const status: TodoView['status'] = s === 'in_progress' || s === 'completed' || s === 'cancelled' ? s : 'pending'
      return { content: (e as { content: string }).content, status }
    })
    .filter((x): x is TodoView => x !== null)
  return items.length ? items : undefined
}

const TERMINAL: ReadonlySet<string> = new Set([
  'settled_success',
  'settled_incomplete',
  'settled_error',
  'cancelled',
])

export function initialRunState(): RunState {
  return { phase: 'idle', status: 'ready' as const, runId: null, version: 0, isStreaming: false, messages: [], pendingQuestion: null, pendingPermission: null, error: null, rejection: null }
}

/** Append an optimistic user row + assistant placeholder when a send is admitted. */
export function startOptimisticTurn(
  state: RunState,
  params: { userMessageId: string; assistantMessageId: string; text: string; runId: string; createdAt: string; attachments?: ChatMessage['attachments'] },
): RunState {
  const user: ChatMessage = {
    id: params.userMessageId, role: 'user', text: params.text, status: 'complete',
    createdAt: params.createdAt, attachments: params.attachments,
  }
  const assistant: ChatMessage = {
    id: params.assistantMessageId, role: 'assistant', text: '', status: 'pending',
    runId: params.runId, createdAt: params.createdAt,
  }
  return {
    ...state,
    phase: 'dispatching',
    runId: params.runId,
    isStreaming: true,
    messages: [...state.messages, user, assistant],
  }
}

/** Optimistically mark the active row's pending permission as decided (after the user responds). */
export function markPermissionDecided(state: RunState, action: 'allow_once' | 'allow' | 'deny'): RunState {
  const i = activeAssistantIndex(state)
  if (i === -1 || !state.messages[i].permission) return state
  const messages = state.messages.slice()
  messages[i] = { ...messages[i], permission: { ...messages[i].permission!, decided: action } }
  return { ...state, messages }
}

/** The active assistant row = the last assistant row (one active run per chat at a time). */
function activeAssistantIndex(state: RunState): number {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === 'assistant') return i
  }
  return -1
}

function patchActive(state: RunState, patch: (m: ChatMessage) => ChatMessage): RunState {
  const i = activeAssistantIndex(state)
  if (i === -1) return state
  const messages = state.messages.slice()
  messages[i] = patch(messages[i])
  return { ...state, messages }
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/**
 * Fold one stream event into the run state. Unknown event names pass through unchanged
 * (name-agnostic — never throw on a new wire name).
 */
export function reduceRunEvent(state: RunState, event: RunStreamEvent): RunState {
  const d = asRecord(event.data)

  switch (event.eventType) {
    case 'start': {
      const runId = typeof d.runId === 'string' ? d.runId : state.runId
      return patchActive(
        { ...state, phase: 'preparing', runId, isStreaming: true },
        (m) => ({
          ...m, status: 'streaming', runId: runId ?? m.runId,
          model: typeof d.model === 'string' ? d.model : m.model,
          provider: typeof d.provider === 'string' ? d.provider : m.provider,
        }),
      )
    }

    case 'run_snapshot': {
      const version = typeof d.version === 'number' ? d.version : state.version
      if (version < state.version) return state // stale snapshot — ignore
      const phase = (typeof d.phase === 'string' ? d.phase : state.phase) as RunPhase | 'idle'
      const terminal = TERMINAL.has(String(phase))
      return {
        ...state, version, phase,
        runId: typeof d.runId === 'string' ? d.runId : state.runId,
        isStreaming: terminal ? false : state.isStreaming,
      }
    }

    case 'progress': {
      const tools = toolCallsFrom(d)
      const todos = todosFrom(d)
      const reasoning = str(d.reasoning) ?? str(d.thinking) ?? str(d.thinkingContent)
      const files = Array.isArray(d.modifiedFiles) ? d.modifiedFiles.filter((f): f is string => typeof f === 'string') : undefined
      // Text delta: prefer an explicit delta; don't treat `content` as text when a tool is present.
      const delta = str(d.delta) ?? (tools.length === 0 ? str(d.text) : undefined)
      const next = patchActive(state, (m) => ({
        ...m,
        status: 'streaming',
        text: delta ? m.text + delta : m.text,
        toolCalls: tools.length ? mergeToolCalls(m.toolCalls, tools) : m.toolCalls,
        todoItems: todos ?? m.todoItems,
        reasoning: reasoning ? (m.reasoning ? m.reasoning + '\n' + reasoning : reasoning) : m.reasoning,
        modifiedFiles: files ?? m.modifiedFiles,
      }))
      return { ...next, phase: next.phase === 'preparing' || next.phase === 'dispatching' ? 'streaming' : next.phase, isStreaming: true }
    }

    case 'content_done':
      // Model content finished; unlock the composer while settlement runs. Not terminal.
      return state

    case 'question':
      return patchActive(
        { ...state, phase: 'waiting_input' },
        (m) => ({
          ...m,
          status: 'streaming',
          question: {
            prompt: typeof d.prompt === 'string' ? d.prompt : typeof d.question === 'string' ? d.question : '',
            options: Array.isArray(d.options) ? (d.options as string[]) : undefined,
          },
        }),
      )

    case 'permission':
      return patchActive(state, (m) => ({
        ...m,
        permission: {
          permissionId: String(d.permissionId ?? ''),
          permissionKind: String(d.permissionKind ?? d.permission ?? 'permission'),
          toolName: str(d.toolName),
          filePath: str(d.filePath),
          patterns: Array.isArray(d.patterns) ? d.patterns.filter((p): p is string => typeof p === 'string') : undefined,
        },
      }))

    case 'verification': {
      // Visual-verification notice: render when a status is present and is NOT 'passed'.
      const vv = asRecord(d.visualVerification ?? asRecord(d.metadata).visualVerification)
      const status = str(vv.status)
      const show = status && status !== 'passed'
      return show
        ? patchActive({ ...state, phase: 'verifying' }, (m) => ({ ...m, visualVerification: { status: status! } }))
        : { ...state, phase: 'verifying' }
    }

    case 'model_failover_applied': {
      const req = asRecord(d.requestedModel)
      const act = asRecord(d.actualModel)
      const requested = str(req.model) ?? ''
      const actual = str(act.model) ?? ''
      if (!requested || !actual) return state
      return patchActive(state, (m) => ({ ...m, failover: { requested, actual, reason: str(d.reason) ?? 'no_healthy_candidate' } }))
    }

    case 'complete': {
      const phase = (typeof d.phase === 'string' ? d.phase : (d.success === false ? 'settled_error' : 'settled_success')) as RunPhase
      return patchActive(
        { ...state, phase, isStreaming: false },
        (m) => ({
          ...m,
          status: phase === 'settled_error' ? 'error' : 'complete',
          gitStatus: gitStatusFrom(d),
          // Finalize any still-running tool calls so the UI doesn't spin forever.
          toolCalls: m.toolCalls?.map((tc) => (tc.toolState === 'running' ? { ...tc, toolState: 'completed' } : tc)),
        }),
      )
    }

    case 'error': {
      const code = typeof d.code === 'string' ? d.code : 'unknown'
      const meta = asRecord(d.metadata)
      // clarification_required surfaces as an interactive question, not a dead error.
      if (code === 'clarification_required') {
        return patchActive({ ...state, phase: 'waiting_input' }, (m) => ({
          ...m, status: 'streaming',
          question: { prompt: typeof meta.intent_label === 'string' ? `Clarify: ${meta.intent_label}` : 'Needs clarification' },
        }))
      }
      return patchActive({ ...state, phase: 'settled_error', isStreaming: false }, (m) => ({ ...m, status: 'error', errorCode: code }))
    }

    case 'human_handoff_requested':
      return patchActive(state, (m) => ({ ...m, handoff: { status: str(d.status) ?? 'pending_bridge' }, status: 'complete' }))

    case 'git_persistence':
      return patchActive(state, (m) => ({ ...m, gitStatus: typeof d.status === 'string' ? d.status : m.gitStatus }))

    default:
      return state // dispatch/enrichment/passthrough names — no state change in v1
  }
}

function gitStatusFrom(complete: Record<string, unknown>): string | undefined {
  const gp = asRecord(complete.gitPersistence)
  return typeof gp.status === 'string' ? gp.status : undefined
}
