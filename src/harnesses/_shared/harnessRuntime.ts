// src/harnesses/_shared/harnessRuntime.ts
// Cross-harness primitives every adapter had hand-rolled identically: the
// exactly-once terminal settler, error-message normalization + truncation, a
// prefixed harness logger, and a small usage meter. SDK-specific event
// translation stays in each harness — only this mechanical, behaviour-identical
// scaffolding lives here. This is NOT a harness adapter (the leading underscore
// signals it is never imported by bootstrap.ts as a registrable directory).

import type { RunIO, TerminalCause } from '../../types/index.js';

export type TerminalError = { code: string; message: string };
export type HarnessLogLevel = 'info' | 'warn' | 'error';

export interface Settler {
  /**
   * Emit the single terminal event for the run. Re-entry is a no-op — the first
   * cause wins, so a late SSE error after a clean idle can never double-settle.
   */
  settle(cause: TerminalCause, error?: TerminalError): void;
  /** True once the terminal has been emitted. */
  readonly settled: boolean;
}

/** The exactly-once terminal guard shared by every harness. */
export function createSettler(io: RunIO): Settler {
  let settled = false;
  return {
    settle(cause, error) {
      if (settled) return;
      settled = true;
      io.emit({ type: 'terminal', cause, ...(error ? { error } : {}) });
    },
    get settled() {
      return settled;
    },
  };
}

/** Normalize any thrown value to a plain message string. */
export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Clamp a string to `max` chars, appending an ellipsis when it overflows. */
export function truncate(s: string | undefined, max = 800): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Build a `log(level, message)` that emits prefixed `harness` log events. */
export function makeHarnessLogger(
  io: RunIO,
  prefix: string
): (level: HarnessLogLevel, message: string) => void {
  return (level, message) =>
    io.emit({
      type: 'log',
      category: 'harness',
      level,
      message: `[${prefix}] ${message}`,
      at: Date.now(),
    });
}

export interface UsageMeter {
  /** Accumulate a per-step delta (provider reports incremental usage). */
  add(deltaInput: number, deltaOutput: number): void;
  /**
   * Fold a cumulative reading (provider reports running totals) and return the
   * positive delta since the last reading, shaped for a `usage_delta` event.
   */
  observeCumulative(nextInput: number, nextOutput: number): { inputTokens: number; outputTokens: number };
  /** Running total of input tokens seen so far. */
  readonly inputTokens: number;
  /** Running total of output tokens seen so far. */
  readonly outputTokens: number;
}

/** A running token tally that supports both delta and cumulative providers. */
export function createUsageMeter(): UsageMeter {
  let inputTokens = 0;
  let outputTokens = 0;
  return {
    add(deltaInput, deltaOutput) {
      inputTokens += deltaInput || 0;
      outputTokens += deltaOutput || 0;
    },
    observeCumulative(nextInput, nextOutput) {
      const dIn = Math.max(0, (nextInput || 0) - inputTokens);
      const dOut = Math.max(0, (nextOutput || 0) - outputTokens);
      inputTokens = Math.max(inputTokens, nextInput || 0);
      outputTokens = Math.max(outputTokens, nextOutput || 0);
      return { inputTokens: dIn, outputTokens: dOut };
    },
    get inputTokens() {
      return inputTokens;
    },
    get outputTokens() {
      return outputTokens;
    },
  };
}
