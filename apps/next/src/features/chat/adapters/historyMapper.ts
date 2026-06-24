import type { ChatHistoryRow, ChatHistoryToolCall } from '@/core/chat'
import type { ChatMessage } from '../types'
import { normalizeToolInput, toolPartType, toolState, type Part } from './streamReducer'

// Durable transcript → UIMessage[] adapter. The mirror of streamReducer: where the reducer maps a
// LIVE SSE frame to assistant parts, this maps a PERSISTED `chat_messages` row to the same Agent
// Elements part shapes, so a reopened chat renders identically to one streamed live. Contract source:
// legacy `src/hooks/chat/useChatMessages.ts::mapRowToMessage` (the interleave of contentChunks +
// toolCalls by timestamp, with thinkingContent as a leading reasoning part).

function toolPart(call: ChatHistoryToolCall, index: number): Part {
  const type = toolPartType(call.tool)
  const rawInput = call.raw ?? (call.file !== undefined ? { filePath: call.file } : undefined)
  const input = normalizeToolInput(rawInput)
  return {
    type,
    toolCallId: call.callID ?? `${type}-${index}`,
    state: toolState(call.toolState),
    ...(input !== undefined ? { input } : {}),
    ...(call.content !== undefined ? { output: call.content } : {}),
  }
}

/** Build an assistant row's parts: reasoning first, then text chunks + tool calls interleaved by time. */
function assistantParts(row: ChatHistoryRow): Part[] {
  const parts: Part[] = []
  // Thinking renders via a `tool-Thinking` part (a bare `reasoning` part is dropped by MessageList).
  // The current run pipeline persists `metadata.thinkingSteps` (the streamed chunks); older rows used
  // the single `thinkingContent` string. Prefer steps (join into one contiguous thought), fall back to
  // the legacy string — without this, reopening a chat dropped the reasoning entirely.
  const thought =
    row.thinkingSteps && row.thinkingSteps.length
      ? row.thinkingSteps.map((s) => s.text).join('')
      : row.thinkingContent
  if (thought) {
    parts.push({
      type: 'tool-Thinking',
      toolCallId: `thinking-${row.id}`,
      state: 'output-available',
      input: { thought },
    })
  }

  // No per-chunk timestamps → treat the full content as one trailing text block (after any tools),
  // matching how the final answer renders below tool activity.
  const textItems = (row.contentChunks?.length
    ? row.contentChunks.map((c) => ({ at: c.at ?? 0, text: c.text }))
    : row.content
      ? [{ at: Number.MAX_SAFE_INTEGER, text: row.content }]
      : []
  ).map((t) => ({ at: t.at, kind: 'text' as const, text: t.text }))

  // Dedupe by callID — the backend persists one toolCalls entry per state transition (running →
  // completed), so the same callID can appear multiple times. Keep the LAST (most complete) and its
  // first-seen position, else two parts share a `toolCallId` → React duplicate-key + double render.
  const byCall = new Map<string, { call: ChatHistoryToolCall; i: number }>()
  ;(row.toolCalls ?? []).forEach((call, i) => {
    const key = call.callID ?? `idx-${i}`
    const prev = byCall.get(key)
    byCall.set(key, { call, i: prev?.i ?? i })
  })
  const toolItems = Array.from(byCall.values()).map(({ call, i }) => ({
    at: call.startedAt ?? 0,
    kind: 'tool' as const,
    call,
    i,
  }))

  const merged = [...textItems, ...toolItems].sort((a, b) => a.at - b.at)
  for (const item of merged) {
    if (item.kind === 'text') {
      if (item.text) parts.push({ type: 'text', text: item.text })
    } else {
      parts.push(toolPart(item.call, item.i))
    }
  }
  return parts
}

/** Convert durable transcript rows to the island's UIMessage[] (Agent Elements shape). */
export function historyRowsToMessages(rows: ChatHistoryRow[]): ChatMessage[] {
  return rows.map((row) => {
    const parts =
      row.role === 'assistant'
        ? assistantParts(row)
        : row.content
          ? [{ type: 'text', text: row.content } as Part]
          : []
    // Agent Elements renders only user/assistant roles; map system/error rows to assistant so their
    // text still shows (error styling comes from the run-state banner, not the row role here).
    const role: ChatMessage['role'] = row.role === 'user' ? 'user' : 'assistant'
    const text = row.content ?? ''
    return { id: row.id, role, text, status: 'complete' as const, parts: parts as unknown as ChatMessage['parts'] }
  })
}
