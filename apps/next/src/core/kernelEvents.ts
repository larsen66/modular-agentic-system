// Frontend mirror of the kernel's SSE wire vocabulary — the INPUT contract for the translator.
//
// Source of truth (keep this union in lockstep):
//   - kernel `src/types/events.ts`  → the 10 normalized `EngineEvent` variants
//   - kernel `src/server/http.ts`   → two custom non-EngineEvent frames: `run_started`, `settled`
//   - kernel `src/server/sse.ts`    → FLAT serialization: every field sits on `data.*`,
//                                      there is NO `data.payload` nesting on the wire.
//
// The kernel tees these to ONE `POST /message` SSE stream. Each frame's SSE `event:` name is the
// discriminant; the `data:` JSON is the whole event object. The translator's exhaustive switch
// (kernelTranslator.ts) consumes this union and a `never` guard fails the build if a variant is
// added here without a matching case — that is the anti-drift property: a new harness/kernel event
// can no longer fall through a silent `default` and vanish.
//
// This module has ZERO imports on purpose (pure contract) so it stays cheap to load and test.

export type KernelWireEvent =
  // ── transport frames (kernel-emitted, not EngineEvents) ──
  | { event: 'run_started'; data: { runId?: string; sessionId?: string; harness?: string; environment?: string } }
  | {
      event: 'settled'
      data: {
        runId?: string
        cause?: string
        finalText?: string
        usage?: { inputTokens?: number; outputTokens?: number }
        cost?: number
        error?: { code?: string; message?: string }
      }
    }
  // ── EngineEvent union (harness/orchestrator-emitted) ──
  | { event: 'stream_chunk'; data: { text?: string } }
  | { event: 'final_text'; data: { text?: string } }
  | { event: 'tool_call'; data: { name?: string; args?: unknown; callId?: string } }
  | { event: 'tool_result'; data: { ok?: boolean; output?: string; callId?: string } }
  | { event: 'preview_ready'; data: { url?: string; port?: number } }
  | { event: 'usage_delta'; data: { inputTokens?: number; outputTokens?: number } }
  | { event: 'child_started'; data: { childRunId?: string } }
  | { event: 'child_settled'; data: { childRunId?: string; cause?: string } }
  | { event: 'log'; data: { category?: string; level?: string; message?: string; at?: number } }
  | { event: 'terminal'; data: { cause?: string; error?: { code?: string; message?: string } } }

export type KernelWireEventName = KernelWireEvent['event']

const KNOWN_EVENT_NAMES: ReadonlySet<string> = new Set<KernelWireEventName>([
  'run_started',
  'settled',
  'stream_chunk',
  'final_text',
  'tool_call',
  'tool_result',
  'preview_ready',
  'usage_delta',
  'child_started',
  'child_settled',
  'log',
  'terminal',
])

/** True for any wire-event name this build knows how to translate. */
export function isKnownKernelEvent(name: string): name is KernelWireEventName {
  return KNOWN_EVENT_NAMES.has(name)
}

/**
 * Narrow a raw parsed SSE frame (`{ event, data }`) into the typed wire union. Returns `null` for an
 * unknown event name (a newer kernel speaking a frame this build predates) — the caller drops it
 * gracefully rather than crashing, while still getting compile-time exhaustiveness over KNOWN events.
 *
 * The `data` cast is the trusted-boundary cast: the wire shape is not validated here, so every
 * downstream read is defensive (`?? fallback`). We never trust a field's presence.
 */
export function narrowKernelEvent(frame: { event: string; data: unknown }): KernelWireEvent | null {
  if (!isKnownKernelEvent(frame.event)) return null
  return { event: frame.event, data: (frame.data ?? {}) } as KernelWireEvent
}
