import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunStreamEvent } from '@/features/chat/types'

// Seam mocks — the hook is glue; transport/admission live in core/chat (tested separately).
const admitAndSend = vi.fn()
const abortRun = vi.fn(async (..._a: unknown[]) => {})
const answerQuestion = vi.fn(async (..._a: unknown[]) => {})
let capturedOnEvent: ((e: RunStreamEvent) => void) | null = null
const unsub = vi.fn()
const subscribeRun = vi.fn((opts: { onEvent: (e: RunStreamEvent) => void }) => { capturedOnEvent = opts.onEvent; return unsub })

const respondToPermission = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/core/chat', () => ({
  admitAndSend: (...a: unknown[]) => admitAndSend(...a),
  subscribeRun: (...a: unknown[]) => subscribeRun(...(a as [{ onEvent: (e: RunStreamEvent) => void }])),
  abortRun: (...a: unknown[]) => abortRun(...a),
  answerQuestion: (...a: unknown[]) => answerQuestion(...a),
  respondToPermission: (...a: unknown[]) => respondToPermission(...a),
}))

const fetchChatThread = vi.fn()
vi.mock('@/core/chats', () => ({ fetchChatThread: (...a: unknown[]) => fetchChatThread(...a) }))

import { useChatRun } from '@/features/chat/hooks/useChatRun'

afterEach(() => { vi.clearAllMocks(); capturedOnEvent = null })

describe('useChatRun', () => {
  it('loads the initial transcript for the chat', async () => {
    fetchChatThread.mockResolvedValue({ messages: [
      { id: 'm1', role: 'user', body: 'hi', status: 'complete', createdAt: '2026-01-01' },
      { id: 'm2', role: 'assistant', body: 'hello', status: 'complete', createdAt: '2026-01-01' },
    ] })
    const { result } = renderHook(() => useChatRun({ chatId: 'c1', sessionId: 's1' }))
    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.messages.map((m) => m.text)).toEqual(['hi', 'hello'])
    expect(result.current.loading).toBe(false)
  })

  it('send → accepted: optimistic rows, subscribes, and applies a streamed delta', async () => {
    fetchChatThread.mockResolvedValue({ messages: [] })
    admitAndSend.mockResolvedValue({ kind: 'accepted', runId: 'r1', phase: 'preparing', duplicate: false })
    const { result } = renderHook(() => useChatRun({ chatId: 'c1', sessionId: 's1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.send('build it') })

    // Optimistic user + assistant rows present; subscription opened.
    expect(result.current.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(result.current.messages[0].text).toBe('build it')
    expect(subscribeRun).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1', runId: 'r1' }))

    // A streamed delta flows through the reducer into the assistant row.
    act(() => { capturedOnEvent?.({ eventType: 'progress', data: { delta: 'working…' } }) })
    expect(result.current.messages[1].text).toBe('working…')
    expect(result.current.isStreaming).toBe(true)

    act(() => { capturedOnEvent?.({ eventType: 'complete', data: { success: true, runId: 'r1' } }) })
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.messages[1].status).toBe('complete')
  })

  it('send → rejected: returns the rejection and does not open a subscription', async () => {
    fetchChatThread.mockResolvedValue({ messages: [] })
    admitAndSend.mockResolvedValue({ kind: 'rejected', code: 'writer_lock_conflict', message: 'busy', retryAfterMs: null })
    const { result } = renderHook(() => useChatRun({ chatId: 'c1', sessionId: 's1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: unknown
    await act(async () => { res = await result.current.send('build it') })

    expect(res).toMatchObject({ kind: 'rejected', code: 'writer_lock_conflict' })
    expect(subscribeRun).not.toHaveBeenCalled()
    expect(result.current.isStreaming).toBe(false)
  })
})
