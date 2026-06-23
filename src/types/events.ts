// src/types/events.ts
// The canonical normalized stream. Core, UI, billing, and settlement consume
// ONLY EngineEvent. Each harness adapter translates its native firehose
// (OpenCode BridgeProgressEvent / ACP notifications / SDK async-iterator) into
// this set. Verbatim from the legacy canonical event set (SPEC §1.3).

export type TerminalCause = 'done' | 'error' | 'cancelled';

export type EngineEvent =
  | { type: 'stream_chunk'; text: string }
  | { type: 'tool_call'; name: string; args?: unknown; callId?: string }
  | { type: 'tool_result'; ok: boolean; output?: string; callId?: string }
  | { type: 'child_started'; childRunId: string }
  | { type: 'child_settled'; childRunId: string; cause: TerminalCause }
  | { type: 'usage_delta'; inputTokens: number; outputTokens: number }
  | { type: 'preview_ready'; url: string; port: number }
  | { type: 'final_text'; text: string }
  // Diagnostic side-channel for the Activity Log: kernel run lifecycle + env
  // substrate lifecycle (provision/exec/file-sync/exposePort/destroy). Purely
  // additive — billing/settlement/UI-chat ignore it; only the log panel renders
  // it. `category` is a coarse bucket; `level` drives colour (error = red).
  | {
      type: 'log';
      category: 'kernel' | 'env' | 'harness';
      level: 'info' | 'warn' | 'error';
      message: string;
      at: number; // epoch ms, stamped at emit time
    }
  | { type: 'terminal'; cause: TerminalCause; error?: { code: string; message: string } };
