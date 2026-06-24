import { describe, it, expect, vi } from 'vitest'
import { createKernelTranslator } from '../kernelTranslator'

// The translator is the single seam from the kernel's flat EngineEvent wire (kernelEvents.ts) to the
// island frame vocabulary streamReducer renders. These tests pin every one of the 12 wire frames so a
// regression in the mapping (or a kernel-side shape change) trips here, not in the UI.

function mk() {
  const onPreview = vi.fn()
  const t = createKernelTranslator('sess-1', onPreview)
  return { t, onPreview }
}

const frame = (event: string, data: unknown) => ({ event, data })

describe('createKernelTranslator', () => {
  it('run_started → start{runId}', () => {
    const { t } = mk()
    expect(t.translate(frame('run_started', { runId: 'r1', harness: 'pi', environment: 'local' }))).toEqual([
      { eventType: 'start', data: { runId: 'r1' } },
    ])
  })

  it('stream_chunk → progress(text)', () => {
    const { t } = mk()
    expect(t.translate(frame('stream_chunk', { text: 'hello' }))).toEqual([
      { eventType: 'progress', data: { payload: { type: 'text', content: 'hello' } } },
    ])
  })

  it('final_text → progress(message) replacing accumulated text', () => {
    const { t } = mk()
    expect(t.translate(frame('final_text', { text: 'all done' }))).toEqual([
      { eventType: 'progress', data: { payload: { type: 'message', message: { content: 'all done' } } } },
    ])
  })

  it('tool_call → tool_use(running) with args spread into raw', () => {
    const { t } = mk()
    expect(t.translate(frame('tool_call', { name: 'bash', callId: 'c1', args: { cmd: 'ls' } }))).toEqual([
      {
        eventType: 'progress',
        data: { payload: { type: 'tool_use', tool: 'bash', toolState: 'running', raw: { callID: 'c1', cmd: 'ls' } } },
      },
    ])
  })

  it('tool_result re-attaches the tool name from the matching call id + carries output', () => {
    const { t } = mk()
    t.translate(frame('tool_call', { name: 'edit', callId: 'c2', args: { file_path: 'a.ts' } }))
    expect(t.translate(frame('tool_result', { callId: 'c2', ok: true, output: 'patched' }))).toEqual([
      {
        eventType: 'progress',
        data: { payload: { type: 'tool_use', tool: 'edit', toolState: 'completed', content: 'patched', raw: { callID: 'c2' } } },
      },
    ])
  })

  it('tool_result ok:false → toolState error', () => {
    const { t } = mk()
    const [out] = t.translate(frame('tool_result', { callId: 'cX', ok: false, output: 'boom' }))
    expect((out.data as { payload: { toolState: string } }).payload.toolState).toBe('error')
  })

  it('preview_ready → fires the injected preview sink, emits no frame', () => {
    const { t, onPreview } = mk()
    expect(t.translate(frame('preview_ready', { url: 'http://x/preview', port: 3000 }))).toEqual([])
    expect(onPreview).toHaveBeenCalledWith('sess-1', 'http://x/preview')
  })

  it('usage_delta accumulates running totals across frames', () => {
    const { t } = mk()
    expect(t.translate(frame('usage_delta', { inputTokens: 10, outputTokens: 5 }))).toEqual([
      { eventType: 'usage', data: { inputTokens: 10, outputTokens: 5 } },
    ])
    expect(t.translate(frame('usage_delta', { inputTokens: 3, outputTokens: 2 }))).toEqual([
      { eventType: 'usage', data: { inputTokens: 13, outputTokens: 7 } },
    ])
  })

  it('log → dropped (diagnostic side-channel, not a transcript frame)', () => {
    const { t } = mk()
    expect(t.translate(frame('log', { category: 'harness', level: 'info', message: 'hi', at: 1 }))).toEqual([])
  })

  it('terminal done → complete; terminal error → error{message,code}', () => {
    const a = mk().t
    expect(a.translate(frame('terminal', { cause: 'done' }))).toEqual([
      { eventType: 'complete', data: { success: true, phase: 'settled_success' } },
    ])
    const b = mk().t
    expect(b.translate(frame('terminal', { cause: 'cancelled' }))).toEqual([
      { eventType: 'complete', data: { success: true, phase: 'cancelled' } },
    ])
    const c = mk().t
    expect(c.translate(frame('terminal', { cause: 'error', error: { code: 'boom', message: 'kaboom' } }))).toEqual([
      { eventType: 'error', data: { error: 'kaboom', code: 'boom' } },
    ])
  })

  it('unknown event → dropped (forward-compat)', () => {
    const { t } = mk()
    expect(t.translate(frame('some_future_event', { whatever: true }))).toEqual([])
  })

  describe('delegated sub-agent (child_*) bracketing', () => {
    it('child_started/settled emit Task boundaries keyed on the childRunId', () => {
      const { t } = mk()
      expect(t.translate(frame('child_started', { childRunId: 'kid1' }))).toEqual([
        { eventType: 'progress', data: { payload: { type: 'tool_use', tool: 'Task', toolState: 'running', childSessionId: 'kid1', raw: { callID: 'kid1' } } } },
      ])
      expect(t.translate(frame('child_settled', { childRunId: 'kid1', cause: 'done' }))).toEqual([
        { eventType: 'progress', data: { payload: { type: 'tool_use', tool: 'Task', toolState: 'completed', childSessionId: 'kid1', raw: { callID: 'kid1' } } } },
      ])
    })

    it("nests a child's inner tool under its Task and drops the child's narration", () => {
      const { t } = mk()
      t.translate(frame('child_started', { childRunId: 'kid1' }))

      // Inner tool_call → tagged with childSessionId + depth so AssistantParts nests it under the Task.
      const inner = t.translate(frame('tool_call', { name: 'read', callId: 'ic1', args: { file_path: 'x' } }))
      const payload = (inner[0].data as { payload: Record<string, unknown> }).payload
      expect(payload.childSessionId).toBe('kid1')
      expect(payload.depth).toBe(1)

      // The child's own text/conclusion must NOT pollute the parent transcript.
      expect(t.translate(frame('stream_chunk', { text: 'child thinking' }))).toEqual([])
      expect(t.translate(frame('final_text', { text: 'child answer' }))).toEqual([])

      // After the child settles, the parent's text flows normally again.
      t.translate(frame('child_settled', { childRunId: 'kid1', cause: 'done' }))
      expect(t.translate(frame('stream_chunk', { text: 'parent text' }))).toEqual([
        { eventType: 'progress', data: { payload: { type: 'text', content: 'parent text' } } },
      ])
    })
  })

  describe('settled frame', () => {
    it('captures authoritative usage/cost', () => {
      const { t } = mk()
      t.translate(frame('terminal', { cause: 'done' })) // terminal first (normal order)
      const out = t.translate(frame('settled', { cause: 'done', usage: { inputTokens: 100, outputTokens: 40 }, cost: 0.012 }))
      expect(out).toEqual([{ eventType: 'usage', data: { inputTokens: 100, outputTokens: 40, cost: 0.012 } }])
    })

    it('backstops completion when no terminal arrived', () => {
      const { t } = mk()
      const out = t.translate(frame('settled', { cause: 'done' }))
      expect(out).toEqual([{ eventType: 'complete', data: { success: true, phase: 'settled_success' } }])
    })

    it('does NOT double-complete when terminal already settled the run', () => {
      const { t } = mk()
      t.translate(frame('terminal', { cause: 'done' }))
      const out = t.translate(frame('settled', { cause: 'done' })) // no usage, terminal seen
      expect(out).toEqual([]) // nothing — completion already emitted by terminal
    })
  })
})
