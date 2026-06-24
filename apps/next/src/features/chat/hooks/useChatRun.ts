import { useCallback, useEffect, useRef, useState } from 'react'
import {
  admitAndSend,
  abortRun,
  postAnswer,
  respondPermission,
  subscribeRun,
  type PermissionAction,
  type SendOpts,
  type SendResult,
  type RunEvent,
} from '@/core/chat'
import { useChatStore } from '../state/chatStore'
import type { ChatMessage } from '../types'
import { initialRunState, reduceRunEvent, startOptimisticTurn } from '../lib/runReducer'

// Run orchestrator: send → admission (admitAndSend) → open SSE stream (subscribeRun) → reduce
// frames into the SHARED chatStore (byChat + runByChat) so ChatPane's useChatMessages / useRunState
// subscriptions see live updates. Local runState is kept only for runId tracking (needed by stop()).

export interface ChatRunControls {
  messages: ChatMessage[]
  loading: boolean
  isStreaming: boolean
  send: (text: string, opts?: SendOpts) => Promise<SendResult | null>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  answer: (requestID: string, answers: string[][]) => Promise<void>
  respondPermission: (permissionId: string, action: PermissionAction) => Promise<void>
  respondToPermission: (permissionId: string, action: PermissionAction) => Promise<void>
}

export function useChatRun(args: {
  sessionId: string | null
  chatId: string | null
}): ChatRunControls {
  const { sessionId, chatId } = args
  const [runState, setRunState] = useState(initialRunState)
  const [loading] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // History is now hydrated by useChatHistory (shared chatStore path); no local transcript load needed.
  useEffect(() => { /* intentional no-op — preserves hook count for HMR stability */ }, [chatId])

  // Unsubscribe on unmount.
  useEffect(() => {
    return () => { unsubRef.current?.() }
  }, [])

  const send = useCallback(async (text: string, opts: SendOpts = {}): Promise<SendResult | null> => {
    if (!sessionId || !chatId) return null
    const trimmed = text.trim()
    if (!trimmed) return null

    const userMsgId = `user-${crypto.randomUUID()}`
    const assistantMsgId = `assistant-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    // Optimistic user turn → shared chatStore (ChatPane reads useChatMessages which selects byChat).
    // skipAppend is set when the caller (useChat provisioning queue) already wrote the row.
    if (!opts.skipAppend) {
      useChatStore.getState().appendUserMessage(chatId, trimmed, userMsgId)
    }
    useChatStore.getState().setRun(chatId, { status: 'submitted', phase: 'preparing', isStreaming: true })

    // Keep local runState in sync for stop() which needs runId.
    setRunState((s) => startOptimisticTurn(s, {
      userMessageId: userMsgId,
      assistantMessageId: assistantMsgId,
      text: trimmed,
      runId: 'pending',
      createdAt: now,
    }))

    const result = await admitAndSend(sessionId, trimmed, opts)

    if (result.kind !== 'accepted') {
      useChatStore.getState().setRun(chatId, { phase: 'idle', status: 'ready', isStreaming: false })
      setRunState((s) => ({ ...s, phase: 'idle', isStreaming: false }))
      return result
    }

    const { runId } = result

    // Update local runId so stop() can abort the right run.
    setRunState((s) => ({ ...s, runId }))

    // Unsubscribe any previous stream.
    unsubRef.current?.()

    // Close over chatId at send-time; the hook may re-render with a new chatId before this stream ends.
    const activeChatId = chatId

    const unsub = subscribeRun({
      sessionId,
      runId,
      onEvent: (e: RunEvent) => {
        // Primary: write to shared chatStore so useChatMessages + useRunState update the UI.
        useChatStore.getState().applyFrame(
          activeChatId,
          { event: e.eventType, data: e.data, id: null },
          runId,
        )
        // Secondary: keep local runState in sync for runId tracking / stop().
        setRunState((s) => reduceRunEvent(s, { eventType: e.eventType, data: e.data as Record<string, unknown> | undefined }))
      },
    })
    unsubRef.current = unsub

    return result
  }, [sessionId, chatId])

  const stop = useCallback(async () => {
    unsubRef.current?.()
    unsubRef.current = null
    if (sessionId && chatId) {
      try {
        const runId = runState.runId ?? undefined
        await abortRun(sessionId, { runId, chatId })
      } catch { /* best-effort */ }
      useChatStore.getState().setRun(chatId, { phase: 'cancelled', status: 'ready', isStreaming: false })
    }
    setRunState((s) => ({ ...s, phase: 'cancelled', isStreaming: false }))
  }, [sessionId, chatId, runState.runId])

  const answer = useCallback(async (requestID: string, answers: string[][]) => {
    if (!sessionId || !chatId) return
    try {
      await postAnswer(sessionId, requestID, answers)
    } catch { /* stream delivers truth */ }
  }, [sessionId, chatId])

  const respondPermissionFn = useCallback(async (permissionId: string, action: PermissionAction) => {
    if (!sessionId || !chatId) return
    try {
      await respondPermission(sessionId, permissionId, action, { chatId })
    } catch { /* stream delivers truth */ }
  }, [sessionId, chatId])

  return {
    messages: runState.messages,
    loading,
    isStreaming: runState.isStreaming,
    send,
    stop,
    cancel: stop,
    answer,
    respondPermission: respondPermissionFn,
    respondToPermission: respondPermissionFn,
  }
}
