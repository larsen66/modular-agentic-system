import { narrowKernelEvent, type KernelWireEvent } from './kernelEvents'

// Kernel → island stream-frame translator. The single seam that maps the kernel's wire vocabulary
// (kernelEvents.ts) onto the island frame vocabulary the streamReducer already renders — so the rich
// UI that shipped with the scaffold (Markdown text, ToolRenderer, Task/Agent nesting, ErrorMessage)
// lights up for EVERY harness without per-harness UI work.
//
// Design:
//   - One translator instance PER RUN (subscribeRun creates it). It carries the cross-frame state a
//     stateless wire can't: callId→toolName (tool_result omits the name), the open-child stack
//     (delegated child events arrive UNTAGGED — bracketed only by child_started/child_settled, see
//     kernel src/kernel/index.ts childSink), a usage accumulator, and a terminal-seen flag.
//   - `translate()` is exhaustive over KnownKernelEvent (the `never` default fails the build if a
//     wire variant is added without a case). Unknown events drop to [] (forward-compat; they are
//     still captured by the Inspector bus in streamKernelMessage).
//   - The preview side-effect is INJECTED (`onPreview`) rather than imported, so this module pulls in
//     no Supabase/transport code and is unit-testable in isolation.
//
// Output frames use the island envelope `{ eventType, data }`; useChatRun renames `eventType`→`event`
// before streamReducer.applyFrame. For `progress` frames the reducer unwraps `data.payload`, so every
// content frame here is shaped `{ eventType:'progress', data:{ payload:{ type, … } } }`.

/** One island stream frame: the translator output / streamReducer input. */
export interface RunEvent {
  eventType: string
  data: unknown
  id?: string
}

export interface KernelTranslator {
  /** Translate one parsed kernel SSE frame into zero or more island frames. */
  translate(frame: { event: string; data: unknown }): RunEvent[]
}

type ToolState = 'running' | 'completed' | 'error'

export function createKernelTranslator(
  sessionId: string,
  onPreview: (sessionId: string, url: string) => void,
): KernelTranslator {
  // callId → tool name. A `tool_result` carries only the callId; we re-attach the name set by the
  // matching `tool_call` so the renderer can pick the right tool component.
  const toolNames = new Map<string, string>()
  // Open delegated children (LIFO). The kernel forwards a child's inner stream_chunk/tool_call/… to
  // the parent wire UNTAGGED, bracketed by child_started/child_settled. We attribute inner events to
  // the most-recently-opened child. Exact for sequential delegation (the default pi path);
  // best-effort for concurrent delegation (boundaries stay correct, inner attribution is heuristic).
  const childStack: string[] = []
  // Token usage accumulates across the run. `usage_delta` is incremental for pi/opencode and
  // aggregate-once for the others; summing is correct for both (kernel settlement.ts does the same).
  let usageIn = 0
  let usageOut = 0
  // Whether a `terminal` EngineEvent has settled the run. Lets `settled` act as a backstop completion
  // only if no terminal arrived (defensive — normally terminal always precedes settled).
  let terminalSeen = false

  const progress = (payload: Record<string, unknown>): RunEvent => ({
    eventType: 'progress',
    data: { payload },
  })

  // A tool_use progress frame, auto-tagged for sub-agent nesting when inside a child. streamReducer
  // keys a nested tool's id as `${childSessionId}:${callID}` so AssistantParts groups it under the
  // Task part whose toolCallId === childSessionId (message-list.tsx taskPartIds/nestedToolsMap).
  function toolUse(opts: {
    name: string
    callId?: string
    state: ToolState
    input?: Record<string, unknown>
    content?: unknown
  }): RunEvent {
    const payload: Record<string, unknown> = {
      type: 'tool_use',
      tool: opts.name,
      toolState: opts.state,
      raw: { callID: opts.callId, ...(opts.input ?? {}) },
    }
    if (childStack.length > 0) {
      payload.childSessionId = childStack[childStack.length - 1]
      payload.depth = childStack.length
    }
    if (opts.content !== undefined) payload.content = opts.content
    return progress(payload)
  }

  // A Task boundary part keyed DIRECTLY on the childRunId (streamReducer: isTask && childSessionId →
  // toolCallId = childSessionId). Not stack-tagged, so child_started/child_settled mark the same part.
  function taskBoundary(childRunId: string, state: ToolState): RunEvent {
    return progress({
      type: 'tool_use',
      tool: 'Task',
      toolState: state,
      childSessionId: childRunId,
      raw: { callID: childRunId },
    })
  }

  function settle(cause: string, error?: { code?: string; message?: string }): RunEvent {
    if (cause === 'error') {
      return { eventType: 'error', data: { error: error?.message ?? 'Run failed', code: error?.code } }
    }
    return {
      eventType: 'complete',
      data: { success: true, phase: cause === 'cancelled' ? 'cancelled' : 'settled_success' },
    }
  }

  function translate(frame: { event: string; data: unknown }): RunEvent[] {
    const ev = narrowKernelEvent(frame)
    if (!ev) return [] // unknown event — forward-compat drop (still in the Inspector bus)

    switch (ev.event) {
      case 'run_started':
        return [{ eventType: 'start', data: { runId: ev.data.runId } }]

      case 'stream_chunk':
        // A delegated child's narration is kept OUT of the parent text flow (the child's work is shown
        // via its Task part); only the main agent's text streams into the transcript.
        if (childStack.length > 0) return []
        return [progress({ type: 'text', content: String(ev.data.text ?? '') })]

      case 'final_text':
        // `message` replaces the accumulated text (dedupes the streamed chunks). A child's final_text
        // would clobber the parent's text — it reaches the parent as the delegate tool_result instead.
        if (childStack.length > 0) return []
        return [progress({ type: 'message', message: { content: String(ev.data.text ?? '') } })]

      case 'tool_call': {
        const name = String(ev.data.name ?? 'tool')
        const callId = typeof ev.data.callId === 'string' ? ev.data.callId : undefined
        if (callId) toolNames.set(callId, name)
        const args =
          ev.data.args && typeof ev.data.args === 'object' ? (ev.data.args as Record<string, unknown>) : {}
        return [toolUse({ name, callId, state: 'running', input: args })]
      }

      case 'tool_result': {
        const callId = typeof ev.data.callId === 'string' ? ev.data.callId : undefined
        const name = (callId && toolNames.get(callId)) || 'tool'
        const ok = ev.data.ok !== false
        return [toolUse({ name, callId, state: ok ? 'completed' : 'error', content: ev.data.output })]
      }

      case 'preview_ready': {
        const url = String(ev.data.url ?? '')
        if (url) onPreview(sessionId, url)
        return [] // side-effect only — the preview pane consumes the bus, not the transcript
      }

      case 'preview_snapshot_ready': {
        // Durable static snapshot — the kernel serves it at /preview/:sessionId/app/ and it survives
        // sandbox teardown (unlike the live preview_ready URL that dies with the sandbox). Surface it
        // on the preview bus as a relative path (Vercel rewrites /preview/* → the kernel) so the pane
        // keeps a working preview after the live one is gone. Side-effect only, like preview_ready.
        onPreview(sessionId, `/preview/${encodeURIComponent(sessionId)}/app/`)
        return []
      }

      case 'usage_delta':
        usageIn += Number(ev.data.inputTokens ?? 0)
        usageOut += Number(ev.data.outputTokens ?? 0)
        return [{ eventType: 'usage', data: { inputTokens: usageIn, outputTokens: usageOut } }]

      case 'child_started': {
        const childRunId = String(ev.data.childRunId ?? '')
        if (!childRunId) return []
        // Emit the boundary keyed on childRunId, THEN push (so the boundary itself isn't self-nested).
        const frame = taskBoundary(childRunId, 'running')
        childStack.push(childRunId)
        return [frame]
      }

      case 'child_settled': {
        const childRunId = String(ev.data.childRunId ?? '')
        if (!childRunId) return []
        // Pop FIRST so the settle boundary isn't tagged as nested in itself.
        const idx = childStack.lastIndexOf(childRunId)
        if (idx !== -1) childStack.splice(idx, 1)
        return [taskBoundary(childRunId, String(ev.data.cause) === 'error' ? 'error' : 'completed')]
      }

      case 'log':
        // Diagnostic side-channel — intentionally NOT shown in chat (already mirrored to the Inspector
        // bus by streamKernelMessage). An explicit case keeps it off the unknown-event path.
        return []

      case 'terminal': {
        terminalSeen = true
        return [settle(String(ev.data.cause ?? 'done'), ev.data.error)]
      }

      case 'settled': {
        const out: RunEvent[] = []
        // Authoritative final usage/cost from settlement (preferred over summed deltas).
        const u = (ev.data.usage ?? {}) as { inputTokens?: number; outputTokens?: number }
        if (u.inputTokens != null || u.outputTokens != null || ev.data.cost != null) {
          out.push({
            eventType: 'usage',
            data: {
              inputTokens: Number(u.inputTokens ?? usageIn),
              outputTokens: Number(u.outputTokens ?? usageOut),
              ...(ev.data.cost != null ? { cost: Number(ev.data.cost) } : {}),
            },
          })
        }
        // Backstop: complete the run from `settled` only if no `terminal` arrived first.
        if (!terminalSeen) out.push(settle(String(ev.data.cause ?? 'done'), ev.data.error))
        return out
      }

      default: {
        // Exhaustiveness guard: adding a KernelWireEvent variant without a case fails the build here.
        const _exhaustive: never = ev
        void _exhaustive
        return []
      }
    }
  }

  return { translate }
}

// Re-export so call sites can `import type { KernelWireEvent }` alongside the translator if needed.
export type { KernelWireEvent }
