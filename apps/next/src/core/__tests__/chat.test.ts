import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the seam's deps: a fixed runner base URL + an auth token. Tests assert the request shape
// (URL, method, body slicing) and the discriminated SendResult, plus SSE frame parsing.
vi.mock('@core/config/ports', () => ({ RUNNER_URL: 'http://runner.test/' }))
vi.mock('@/core/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-123' } } }) } },
}))

import { admitAndSend, subscribeRun } from '@/core/chat'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => fetchMock.mockReset())

describe('admitAndSend', () => {
  it('POSTs to /sessions/:id/chat with Bearer + prompt, returns accepted on 202', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { runId: 'r1', phase: 'preparing' }))
    const res = await admitAndSend('sess-1', 'build a thing', { chatId: 'c1', idempotencyKey: 'k1' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://runner.test/sessions/sess-1/chat')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ prompt: 'build a thing', chatId: 'c1', idempotencyKey: 'k1' })
    expect(res).toEqual({ kind: 'accepted', runId: 'r1', phase: 'preparing', duplicate: false })
  })

  it('marks duplicate admits (200 duplicate=true)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { runId: 'r1', phase: 'streaming', duplicate: true }))
    const res = await admitAndSend('sess-1', 'hi')
    expect(res).toEqual({ kind: 'accepted', runId: 'r1', phase: 'streaming', duplicate: true })
  })

  it('omits model/provider unless BOTH set; includes effort as depthPresetId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { runId: 'r1', phase: 'preparing' }))
    await admitAndSend('s', 'p', { model: 'gpt', depthPresetId: 'deep' }) // provider missing → omit model
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBeUndefined()
    expect(body.provider).toBeUndefined()
    expect(body.depthPresetId).toBe('deep')
  })

  it('treats 202 rejection_code as an admission rejection (not an accept)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { rejection_code: 'insufficient_balance', message: 'No credits' }))
    const res = await admitAndSend('s', 'p')
    expect(res).toEqual({ kind: 'rejected', code: 'insufficient_balance', message: 'No credits', retryAfterMs: null, activeWriterChatId: undefined })
  })

  it('classifies 409 writer_lock_conflict as rejected with activeWriterChatId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: 'writer_lock_conflict', message: 'busy', activeWriterChatId: 'c9' }))
    const res = await admitAndSend('s', 'p')
    expect(res).toMatchObject({ kind: 'rejected', code: 'writer_lock_conflict', activeWriterChatId: 'c9' })
  })

  it('classifies 409 session_run_active as rejected, default retry 3000ms', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: 'session_run_active', message: 'wait' }))
    const res = await admitAndSend('s', 'p')
    expect(res).toMatchObject({ kind: 'rejected', code: 'session_run_active', retryAfterMs: 3000 })
  })

  it('classifies 503 ai_preparing as retryable rejection', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { code: 'ai_preparing', message: 'warming up' }))
    const res = await admitAndSend('s', 'p')
    expect(res).toMatchObject({ kind: 'rejected', code: 'ai_preparing' })
  })

  it('treats 401 as a fatal, non-retryable error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { code: 'auth_expired', message: 'expired' }))
    const res = await admitAndSend('s', 'p')
    expect(res).toMatchObject({ kind: 'error', code: 'auth_expired', fatal: true, retryable: false })
  })

  it('returns a retryable network error when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const res = await admitAndSend('s', 'p')
    expect(res).toMatchObject({ kind: 'error', code: 'network', status: 0, retryable: true })
  })
})

describe('subscribeRun (SSE)', () => {
  function streamResponse(frames: string): Response {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frames))
        controller.close()
      },
    })
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }

  it('parses name + data + id frames, advances the cursor, dispatches each event', async () => {
    // One streaming response, then an aborting unsubscribe stops the reconnect loop.
    fetchMock.mockResolvedValueOnce(
      streamResponse(
        'event: start\ndata: {"runId":"r1"}\nid: 5\n\n' +
        'event: progress\ndata: {"delta":"hi"}\nid: 6\n\n',
      ),
    ).mockResolvedValue(streamResponse(''))

    const events: Array<{ eventType: string; data: unknown; id?: string }> = []
    const stop = subscribeRun({ sessionId: 's', runId: 'r1', onEvent: (e) => events.push(e) })
    await new Promise((r) => setTimeout(r, 30))
    stop()

    expect(events[0]).toEqual({ eventType: 'start', data: { runId: 'r1' }, id: '5' })
    expect(events[1]).toEqual({ eventType: 'progress', data: { delta: 'hi' }, id: '6' })
    // The first request used the initial cursor (since=0).
    expect(fetchMock.mock.calls[0][0]).toContain('since=0')
  })

  it('ignores SSE comments/heartbeats and keeps non-JSON data as a raw string', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse(': heartbeat\n\nevent: ping\ndata: not-json\n\n'),
    ).mockResolvedValue(streamResponse(''))

    const events: Array<{ eventType: string; data: unknown }> = []
    const stop = subscribeRun({ sessionId: 's', runId: 'r1', onEvent: (e) => events.push(e) })
    await new Promise((r) => setTimeout(r, 30))
    stop()

    expect(events).toEqual([{ eventType: 'ping', data: 'not-json', id: undefined }])
  })
})
