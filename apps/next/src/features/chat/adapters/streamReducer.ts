import type { ChatStatus } from 'ai'
import type { RawStreamFrame } from '@/core/chat'
import type { ChatMessage, PendingPermission, PendingQuestion, RunPhase, RunState } from '../types'
import { TERMINAL_PHASES } from '../types'

// Stream → UIMessage adapter (the run-lifecycle "presentation mapping" from
// docs/design/chat/_NOTE-agent-elements.md §2). Pure: applies one raw SSE frame to the accumulating
// assistant message + run state. Event protocol mined in docs/design/chat/legacy/run-lifecycle.md
// + agent-activity.md; shapes from shared/chat-events.ts.

export interface ReducerState {
  messages: ChatMessage[]
  run: RunState
}

export type Part = Record<string, unknown> & { type: string }

// Runner tool name → Agent Elements tool-part suffix (tool-renderer.tsx switch / registry).
// Accepts both bare OpenCode names and the `mcp_`-prefixed variants the runner sometimes emits.
const TOOL_NAME_MAP: Record<string, string> = {
  bash: 'Bash',
  edit: 'Edit',
  write: 'Write',
  read: 'Read',
  grep: 'Grep',
  glob: 'Glob',
  list: 'Read',
  ls: 'Read',
  websearch: 'WebSearch',
  web_search: 'WebSearch',
  webfetch: 'WebFetch',
  web_fetch: 'WebFetch',
  fetch: 'WebFetch',
  task: 'Task',
  agent: 'Agent',
  todowrite: 'TodoWrite',
  todoread: 'TodoWrite',
  planwrite: 'PlanWrite',
  question: 'Question',
  think: 'Thinking',
  thinking: 'Thinking',
}

export function toolPartType(name: string): string {
  let key = (name ?? '').toLowerCase()
  // Strip the runner's `mcp_` prefix (e.g. `mcp_todowrite` → `todowrite`); true MCP tools use the
  // `mcp__server__tool` double-underscore form which we leave intact for AE's registry parser.
  if (key.startsWith('mcp_') && !key.startsWith('mcp__')) key = key.slice(4)
  const mapped = TOOL_NAME_MAP[key]
  if (mapped) return `tool-${mapped}`
  // Preserve the original (possibly `mcp__server__tool`) name so AE's MCP/registry paths can match.
  return `tool-${name ?? 'Unknown'}`
}

// OpenCode emits camelCase arg keys (filePath/oldString/newString); Agent Elements' renderers read
// snake_case (file_path/old_string/new_string) plus command/pattern/query/url/todos/thought. We keep
// the originals and ADD the aliases AE expects, so both forms resolve. (tool-adapters.ts contracts.)
const KEY_ALIASES: Record<string, string> = {
  filePath: 'file_path',
  oldString: 'old_string',
  newString: 'new_string',
  filepath: 'file_path',
}

export function normalizeToolInput(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return raw === undefined ? undefined : { value: raw }
  const src = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    if (k === '_output') continue // runner's truncated output snippet — not an input arg
    out[k] = v
    const alias = KEY_ALIASES[k]
    if (alias && !(alias in src)) out[alias] = v
  }
  return out
}

export function toolState(runnerState: string | undefined): string {
  if (runnerState === 'completed') return 'output-available'
  if (runnerState === 'error') return 'output-error'
  return 'input-available'
}

function phaseToStatus(phase: RunPhase): ChatStatus {
  switch (phase) {
    case 'dispatching':
    case 'preparing':
      return 'submitted'
    case 'streaming':
    case 'verifying':
    case 'waiting_children':
      return 'streaming'
    case 'settled_error':
      return 'error'
    default:
      return 'ready'
  }
}

function ensureAssistant(messages: ChatMessage[], runId: string | null): ChatMessage[] {
  const id = `assistant-${runId ?? 'pending'}`
  if (messages.some((m) => m.id === id)) return messages
  return [...messages, { id, role: 'assistant', text: '', status: 'pending' as const, parts: [] } as ChatMessage]
}

function lastAssistantIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') return i
  }
  return -1
}

/** Immutably update the trailing assistant message's parts. */
function updateAssistantParts(
  messages: ChatMessage[],
  updater: (parts: Part[]) => Part[],
): ChatMessage[] {
  const idx = lastAssistantIndex(messages)
  if (idx === -1) return messages
  const msg = messages[idx]
  const nextParts = updater([...((msg.parts as unknown as Part[]) ?? [])])
  const next = messages.slice()
  next[idx] = { ...msg, parts: nextParts as unknown as ChatMessage['parts'] }
  return next
}

// Flip a trailing still-"streaming" Thinking part to done — called before appending the NEXT kind of
// content (text/tool), since the model has moved on from that reasoning block. The currently-growing
// thinking block stays `input-streaming` (so the renderer shimmers + auto-expands it); the run's
// terminal flip below finalizes whatever's last.
function finalizeStreamingThinking(parts: Part[]): Part[] {
  const last = parts[parts.length - 1]
  if (last && last.type === 'tool-Thinking' && last.state === 'input-streaming') {
    return [...parts.slice(0, -1), { ...last, state: 'output-available' }]
  }
  return parts
}

// On run end, flip any still-`input-streaming` Thinking part in the trailing assistant message to done
// so it stops shimmering / collapses to a finished "Thought".
function finalizeThinkingOnSettle(messages: ChatMessage[]): ChatMessage[] {
  if (!messages.length) return messages
  const idx = messages.length - 1
  const msg = messages[idx]
  if (msg.role !== 'assistant') return messages
  const parts = msg.parts as unknown as Part[]
  let changed = false
  const nextParts = parts.map((p) => {
    if (p.type === 'tool-Thinking' && p.state === 'input-streaming') {
      changed = true
      return { ...p, state: 'output-available' }
    }
    return p
  })
  if (!changed) return messages
  const next = messages.slice()
  next[idx] = { ...msg, parts: nextParts as unknown as ChatMessage['parts'] }
  return next
}

function appendText(parts: Part[], text: string): Part[] {
  if (!text) return parts
  parts = finalizeStreamingThinking(parts)
  const last = parts[parts.length - 1]
  if (last && last.type === 'text') {
    return [...parts.slice(0, -1), { ...last, text: `${(last.text as string) ?? ''}${text}` }]
  }
  return [...parts, { type: 'text', text }]
}

// Agent thinking → a `tool-Thinking` part (AE renders these; a bare `reasoning` part is DROPPED by
// MessageList). Streamed thought chunks accumulate into one contiguous Thinking part.
function appendThinking(parts: Part[], text: string): Part[] {
  if (!text) return parts
  const last = parts[parts.length - 1]
  if (last && last.type === 'tool-Thinking') {
    const prevInput = (last.input as Record<string, unknown>) ?? {}
    const prevThought = (prevInput.thought as string) ?? ''
    // Keep it `input-streaming` while chunks accumulate → the renderer shimmers + auto-expands the
    // live reasoning instead of showing a collapsed "Thought" only at the end.
    return [
      ...parts.slice(0, -1),
      { ...last, state: 'input-streaming', input: { ...prevInput, thought: prevThought + text } },
    ]
  }
  return [
    ...parts,
    {
      type: 'tool-Thinking',
      toolCallId: `thinking-${parts.length}`,
      state: 'input-streaming',
      input: { thought: text },
    },
  ]
}

function upsertTool(
  parts: Part[],
  toolCallId: string | undefined,
  toolName: string,
  runnerState: string | undefined,
  input: unknown,
  output: unknown,
): Part[] {
  // A tool call means the model finished its current reasoning block — settle it before the tool part.
  parts = finalizeStreamingThinking(parts)
  const type = toolPartType(toolName)
  const state = toolState(runnerState)
  const id = toolCallId ?? `${type}-${parts.length}`
  const idx = parts.findIndex((p) => p.type.startsWith('tool-') && p.toolCallId === id)
  const part: Part = {
    type,
    toolCallId: id,
    state,
    ...(input !== undefined ? { input } : {}),
    ...(output !== undefined ? { output } : {}),
  }
  if (idx === -1) return [...parts, part]
  const next = parts.slice()
  const prev = next[idx]
  // MERGE input across frames: a `tool_result` carries only the callID (no args), so a plain
  // `{...prev, ...part}` would clobber the real args captured at `tool_call` time — leaving the
  // card with an empty input (blank filename/command). Preserve older keys; newer non-empty wins.
  const prevInput = (prev.input ?? {}) as Record<string, unknown>
  const newInput = (input ?? {}) as Record<string, unknown>
  const mergedInput = { ...prevInput, ...newInput }
  next[idx] = {
    ...prev,
    ...part,
    ...(Object.keys(mergedInput).length > 0 ? { input: mergedInput } : {}),
  }
  return next
}

function normalizeQuestion(data: Record<string, unknown>): PendingQuestion | null {
  const requestID = (data.requestID ?? data.requestId ?? data.callID) as string | undefined
  if (!requestID) return null
  const rawList = (data.questions ?? (data.question ? [data.question] : [])) as Record<
    string,
    unknown
  >[]
  const questions = (rawList ?? []).map((q, i) => {
    const options = (q.options ?? q.choices) as unknown
    const optionList = Array.isArray(options)
      ? options.map((o) => (typeof o === 'string' ? o : String((o as { label?: string }).label ?? o)))
      : undefined
    // Runner emits `multiple: boolean` (PendingQuestionSnapshot); also accept a `kind` string.
    const isMulti = q.multiple === true || (q.kind as string) === 'multi'
    const kind = isMulti ? 'multi' : optionList && optionList.length ? 'single' : 'text'
    return {
      id: (q.id as string) ?? `${requestID}-${i}`,
      kind: kind as 'single' | 'multi' | 'text',
      prompt: (q.prompt ?? q.text ?? q.question ?? q.header ?? '') as string,
      options: optionList,
      allowCustomInput: q.allowCustomInput === true,
    }
  })
  if (!questions.length) return null
  return { requestID, callID: data.callID as string | undefined, questions }
}

function normalizePermission(data: Record<string, unknown>): PendingPermission | null {
  const permissionId = (data.permissionId ?? data.id) as string | undefined
  if (!permissionId) return null
  return {
    permissionId,
    permissionKind: data.permissionKind as string | undefined,
    toolName: data.toolName as string | undefined,
    filePath: data.filePath as string | undefined,
    patterns: Array.isArray(data.patterns) ? (data.patterns as string[]) : undefined,
    callID: data.callID as string | undefined,
  }
}

/** Apply one stream frame to the reducer state. */
export function applyFrame(state: ReducerState, frame: RawStreamFrame, runId: string): ReducerState {
  const data = (frame.data ?? {}) as Record<string, unknown>
  let { messages, run } = state

  switch (frame.event) {
    case 'start': {
      messages = ensureAssistant(messages, runId)
      run = { ...run, runId, phase: 'streaming', status: 'streaming', error: null }
      return { messages, run }
    }

    case 'run_snapshot': {
      const phase = (data.phase as RunPhase) ?? run.phase
      const terminal = TERMINAL_PHASES.has(phase)
      run = {
        ...run,
        phase,
        status: phaseToStatus(phase),
        ...(phase === 'settled_error' && data.error
          ? { error: { message: String(data.error) } }
          : {}),
      }
      if (terminal && run.pendingQuestion && phase !== 'waiting_input') {
        run = { ...run, pendingQuestion: null }
      }
      if (terminal) messages = finalizeThinkingOnSettle(messages)
      return { messages, run }
    }

    case 'progress': {
      // `progress` data IS the OpenCodeProgress: { type, content, tool, toolState, file, agent,
      // depth, childSessionId, raw:{ callID, ...args } }. (runner chatRunProgress.ts / opencode/_impl.ts)
      const payload = ((data.payload ?? data) as Record<string, unknown>) ?? {}
      const ptype = payload.type as string
      // Any live progress means a permission (if one was pending) has been resolved and the run resumed.
      if (run.pendingPermission) run = { ...run, pendingPermission: null }
      messages = ensureAssistant(messages, runId)
      if (ptype === 'text') {
        const content = (payload.content as string) ?? ''
        messages = updateAssistantParts(messages, (parts) => appendText(parts, content))
        run = { ...run, status: 'streaming', phase: run.phase === 'idle' ? 'streaming' : run.phase }
      } else if (ptype === 'thinking') {
        const content = (payload.content as string) ?? (payload.text as string) ?? ''
        messages = updateAssistantParts(messages, (parts) => appendThinking(parts, content))
      } else if (ptype === 'tool_use') {
        const name = (payload.tool ?? payload.toolName ?? payload.name ?? 'tool') as string
        const lower = name.toLowerCase()
        if (lower === 'think' || lower === 'thinking') {
          const content = (payload.content as string) ?? ''
          messages = updateAssistantParts(messages, (parts) => appendThinking(parts, content))
        } else {
          const raw = payload.raw as Record<string, unknown> | undefined
          const callID = (raw?.callID ?? raw?.id ?? raw?.toolCallId ?? raw?.toolCallID ?? payload.callID) as
            | string
            | undefined
          const childSessionId = (payload.childSessionId ?? raw?.childSessionId) as string | undefined
          const depth = Number(payload.depth ?? raw?.depth ?? 0)
          const isTask = lower === 'task' || lower === 'agent' || lower === 'mcp_task'
          // Sub-agent grouping: AE nests a tool under a Task when its toolCallId is `${parent}:${child}`
          // and the parent is a Task part's toolCallId. We key the group on childSessionId.
          let toolCallId = callID
          if (isTask && childSessionId) toolCallId = childSessionId
          else if (childSessionId && depth > 0) toolCallId = `${childSessionId}:${callID ?? 'child'}`
          const input = normalizeToolInput(raw)
          const out = (payload.content ?? raw?._output) as unknown
          const output = typeof out === 'string' && out.length === 0 ? undefined : out
          messages = updateAssistantParts(messages, (parts) =>
            upsertTool(parts, toolCallId, name, payload.toolState as string | undefined, input, output),
          )
        }
        run = { ...run, status: 'streaming', phase: run.phase === 'idle' ? 'streaming' : run.phase }
      } else if (ptype === 'message') {
        const full = ((payload.message as Record<string, unknown>)?.content as string) ?? ''
        if (full) {
          messages = updateAssistantParts(messages, (parts) => {
            const withoutText = parts.filter((p) => p.type !== 'text')
            return [...withoutText, { type: 'text', text: full }]
          })
        }
      }
      return { messages, run }
    }

    case 'question': {
      const pending = normalizeQuestion(data)
      run = { ...run, pendingQuestion: pending, phase: 'waiting_input', status: 'ready' }
      return { messages, run }
    }

    case 'permission': {
      const pending = normalizePermission(data)
      run = { ...run, pendingPermission: pending, phase: 'waiting_input', status: 'ready' }
      return { messages, run }
    }

    case 'complete': {
      const success = data.success !== false
      messages = finalizeThinkingOnSettle(messages)
      run = {
        ...run,
        phase: success ? 'settled_success' : 'settled_error',
        status: success ? 'ready' : 'error',
        pendingQuestion: null,
        pendingPermission: null,
        ...(success ? {} : { error: run.error ?? { message: 'Run failed' } }),
      }
      return { messages, run }
    }

    case 'usage': {
      // Token usage (+ optional cost) accumulated by the translator from kernel usage_delta/settled.
      // Stored on run state so a usage chip / the Inspector can read it; not a transcript part.
      const inputTokens = Number(data.inputTokens ?? 0)
      const outputTokens = Number(data.outputTokens ?? 0)
      const cost = data.cost != null ? Number(data.cost) : undefined
      run = { ...run, usage: { inputTokens, outputTokens, ...(cost != null ? { cost } : {}) } }
      return { messages, run }
    }

    case 'error': {
      const message = String(data.error ?? 'Run error')
      // Surface the failure IN the transcript: AssistantParts renders a `{ type:'error' }` part via
      // <ErrorMessage>. Without appending the part the run only flips run.error and the error is
      // invisible in the message list (the bug this fixes).
      messages = ensureAssistant(messages, runId)
      messages = updateAssistantParts(messages, (parts) => [...parts, { type: 'error', message } as Part])
      messages = finalizeThinkingOnSettle(messages)
      run = {
        ...run,
        phase: 'settled_error',
        status: 'error',
        pendingQuestion: null,
        pendingPermission: null,
        error: { message, code: data.code as string | undefined },
      }
      return { messages, run }
    }

    default:
      return state
  }
}
