// src/kernel/settlement.ts
// Settlement ALWAYS fires exactly once. It accumulates content + usage as the
// EngineEvent stream flows, then on `terminal` (or on an unexpected error)
// finalizes content, classifies the cause, runs the billing stub from
// accumulated usage_delta events, and produces the terminal result.

import type { EngineEvent, TerminalCause } from '../types/index.js';

export interface RunResult {
  runId: string;
  cause: TerminalCause;
  finalText: string;
  usage: { inputTokens: number; outputTokens: number };
  cost: number; // stub billing
  error?: { code: string; message: string };
}

// Toy price table — billing is a stub that sums usage_delta. (Out of MVP scope
// beyond proving settlement runs from accumulated usage.)
const PRICE_PER_INPUT_TOKEN = 0.000003;
const PRICE_PER_OUTPUT_TOKEN = 0.000015;

export class Settlement {
  private finalText = '';
  private streamBuffer = '';
  private inputTokens = 0;
  private outputTokens = 0;
  private settled = false;
  // The cause/error are recorded ONCE, at first settlement, and become
  // authoritative — later settle() calls (e.g. the orchestrator's defensive
  // call) must not overwrite the cause the harness's terminal event declared.
  private settledCause: TerminalCause = 'done';
  private settledError?: { code: string; message: string };

  constructor(private readonly runId: string) {}

  // Fold one event into the accumulators. Returns the settled RunResult exactly
  // once when a `terminal` event arrives; null otherwise.
  observe(ev: EngineEvent): RunResult | null {
    switch (ev.type) {
      case 'stream_chunk':
        this.streamBuffer += ev.text;
        return null;
      case 'final_text':
        this.finalText = ev.text;
        return null;
      case 'usage_delta':
        this.inputTokens += ev.inputTokens;
        this.outputTokens += ev.outputTokens;
        return null;
      case 'terminal':
        return this.settle(ev.cause, ev.error);
      default:
        return null;
    }
  }

  // Force settlement if the harness threw before emitting `terminal`. The FIRST
  // call wins (records the authoritative cause/error); later calls are no-ops
  // that return the already-recorded result. Idempotent by design.
  settle(cause: TerminalCause, error?: { code: string; message: string }): RunResult {
    if (!this.settled) {
      this.settled = true;
      this.settledCause = cause;
      this.settledError = error;
    }
    return this.snapshot();
  }

  get isSettled(): boolean {
    return this.settled;
  }

  private snapshot(): RunResult {
    const cost =
      this.inputTokens * PRICE_PER_INPUT_TOKEN + this.outputTokens * PRICE_PER_OUTPUT_TOKEN;
    return {
      runId: this.runId,
      cause: this.settledCause,
      finalText: this.finalText || this.streamBuffer,
      usage: { inputTokens: this.inputTokens, outputTokens: this.outputTokens },
      cost: Number(cost.toFixed(6)),
      error: this.settledError,
    };
  }
}
