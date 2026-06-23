// src/harnesses/openai-agents/events.ts
// Translate the OpenAI Agents SDK's native stream (RunStreamEvent) into our
// canonical EngineEvent set — for the REAL-SDK path only.
//
// Division of labour (avoid double-emitting):
//   • tool_call / tool_result  — emitted from INSIDE executeTool (execEngine.ts),
//     where the real execution seam fires. We deliberately do NOT re-emit them
//     from the SDK's `tool_called`/`tool_output` run-item events.
//   • stream_chunk             — emitted here from raw-model `output_text_delta`
//     events (incremental assistant text).
//   • final_text / usage_delta / terminal — emitted by the harness (index.ts)
//     from the RESOLVED run result, after the stream completes.
//
// The SDK's RunStreamEvent is a discriminated union on `type`; we only react to
// the raw-model text-delta shape.

import type { RunIO } from '../../types/index.js';
import type { RunStreamEvent } from '@openai/agents';

// The raw-model payload we care about: an incremental output-text delta. Shape
// per the OpenAI-compatible streaming protocol (StreamEventTextStream):
//   { type: 'output_text_delta', delta: string }
function extractTextDelta(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { type?: unknown; delta?: unknown };
  if (d.type === 'output_text_delta' && typeof d.delta === 'string' && d.delta.length > 0) {
    return d.delta;
  }
  return null;
}

/**
 * Project a single SDK stream event into zero-or-one EngineEvent emit. Only
 * incremental text is surfaced here; tool + terminal events are owned elsewhere
 * (see module header). Returns the text chunk emitted (for accumulation), if any.
 */
export function projectStreamEvent(ev: RunStreamEvent, io: RunIO): string | null {
  if (ev.type === 'raw_model_stream_event') {
    const text = extractTextDelta(ev.data);
    if (text) {
      io.emit({ type: 'stream_chunk', text });
      return text;
    }
  }
  // run_item_stream_event / agent_updated_stream_event are intentionally skipped.
  return null;
}
