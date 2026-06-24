import { create } from 'zustand'
import type { RawStreamFrame } from '@/core/chat'
import { emitInspector } from '@/core/inspector'
import type { ChatMessage, RunState } from '../types'
import { IDLE_RUN } from '../types'
import { applyFrame as reduceFrame } from '../adapters/streamReducer'

// Per-chat message + run state, keyed by chatId. Messages are UIMessage[] (Agent Elements shape);
// the assistant turn is mutated in place by the stream reducer as frames arrive.
//
// This store is also the front-end tap for the run-flow inspector (source 'user'/'run'): the user
// request, every translated frame, run-phase transitions, and the FINAL RESULT all funnel through
// here, so the DevTools "Agent Stream" panel can trace one run end-to-end (see core/inspector.ts).

const EMPTY: ChatMessage[] = []

/** Human-readable event name for a translated run frame (the post-kernel UI layer). */
function frameEventName(frame: RawStreamFrame): string {
  if (frame.event === 'progress') {
    const payload = (frame.data as { payload?: { type?: string } } | undefined)?.payload
    return `progress:${payload?.type ?? 'unknown'}`
  }
  return `run:${frame.event}`
}

/** Last assistant message text — the "final result" of a run. */
function lastAssistantText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i].text ?? ''
  }
  return ''
}

interface ChatStoreState {
  byChat: Record<string, ChatMessage[]>
  runByChat: Record<string, RunState>
  /** Replace a chat's messages (e.g. when loading history). */
  setMessages: (chatId: string, messages: ChatMessage[]) => void
  /** Seed a chat's messages from durable history — only if it has none yet (never clobbers live). */
  hydrateMessages: (chatId: string, messages: ChatMessage[]) => void
  /** Append a user turn (optimistic). */
  appendUserMessage: (chatId: string, text: string, id: string) => void
  /** Append an assistant notice turn (e.g. an admission rejection shown in the transcript). */
  appendAssistantNotice: (chatId: string, text: string, id: string) => void
  /** Apply a stream frame to the chat's trailing assistant turn + run state. */
  applyFrame: (chatId: string, frame: RawStreamFrame, runId: string) => void
  /** Merge partial run state. */
  setRun: (chatId: string, partial: Partial<RunState>) => void
  /** Reset run state to idle. */
  resetRun: (chatId: string) => void
}

export const useChatStore = create<ChatStoreState>((set) => ({
  byChat: {},
  runByChat: {},

  setMessages: (chatId, messages) =>
    set((s) => ({ byChat: { ...s.byChat, [chatId]: messages } })),

  hydrateMessages: (chatId, messages) =>
    set((s) => {
      const existing = s.byChat[chatId]
      // A live/optimistic transcript already exists for this chat — don't overwrite it with history.
      if (existing && existing.length > 0) return {}
      return { byChat: { ...s.byChat, [chatId]: messages } }
    }),

  appendUserMessage: (chatId, text, id) => {
    emitInspector({ source: 'user', event: 'request', data: { text, id }, chatId })
    set((s) => {
      const prev = s.byChat[chatId] ?? EMPTY
      const userMsg: ChatMessage = { id, role: 'user', text, status: 'complete', parts: [{ type: 'text', text }] }
      return { byChat: { ...s.byChat, [chatId]: [...prev, userMsg] } }
    })
  },

  appendAssistantNotice: (chatId, text, id) => {
    emitInspector({ source: 'run', event: 'notice', data: { text, id }, chatId })
    set((s) => {
      const prev = s.byChat[chatId] ?? EMPTY
      const msg: ChatMessage = { id, role: 'assistant', text, status: 'complete', parts: [{ type: 'text', text }] }
      return { byChat: { ...s.byChat, [chatId]: [...prev, msg] } }
    })
  },

  applyFrame: (chatId, frame, runId) => {
    let finalText: string | null = null
    set((s) => {
      const messages = s.byChat[chatId] ?? EMPTY
      const run = s.runByChat[chatId] ?? IDLE_RUN
      const next = reduceFrame({ messages, run }, frame, runId)
      if (frame.event === 'complete') finalText = lastAssistantText(next.messages)
      return {
        byChat: { ...s.byChat, [chatId]: next.messages },
        runByChat: { ...s.runByChat, [chatId]: next.run },
      }
    })
    const isError = frame.event === 'error'
    emitInspector({
      source: 'run',
      event: frameEventName(frame),
      level: isError ? 'error' : 'info',
      data: frame.data,
      chatId,
      runId,
    })
    // The terminal "final result" — the user-visible answer to the request that started this run.
    if (finalText != null) {
      emitInspector({ source: 'run', event: 'final_result', data: { text: finalText }, chatId, runId })
    }
  },

  setRun: (chatId, partial) => {
    emitInspector({ source: 'run', event: `phase:${partial.phase ?? partial.status ?? 'update'}`, data: partial, chatId })
    set((s) => ({
      runByChat: { ...s.runByChat, [chatId]: { ...(s.runByChat[chatId] ?? IDLE_RUN), ...partial } },
    }))
  },

  resetRun: (chatId) =>
    set((s) => ({ runByChat: { ...s.runByChat, [chatId]: { ...IDLE_RUN } } })),
}))

/** Stable selector for one chat's messages. */
export function useChatMessages(chatId: string | null): ChatMessage[] {
  return useChatStore((s) => (chatId ? s.byChat[chatId] : undefined)) ?? EMPTY
}

/** Stable selector for one chat's run state. */
export function useRunState(chatId: string | null): RunState {
  return useChatStore((s) => (chatId ? s.runByChat[chatId] : undefined)) ?? IDLE_RUN
}
