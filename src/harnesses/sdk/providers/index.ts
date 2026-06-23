// src/harnesses/sdk/providers/index.ts
// Provider auto-detection (SPEC: "detect ANTHROPIC_API_KEY / OPENAI_API_KEY,
// use whichever is present"). Anthropic wins when both are set. Throws a clear,
// actionable error when neither key is present — the one piece that genuinely
// needs a real credential.

import { createAnthropicProvider } from './anthropic.js';
import { createOpenAiProvider } from './openai.js';
import type { LlmProvider } from './types.js';

export * from './types.js';

export class NoLlmKeyError extends Error {
  constructor() {
    super(
      'No model API key found. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY ' +
        'in the environment to run the real SDK harness. (For wire-level verification ' +
        'without a real key, point ANTHROPIC_BASE_URL at the bundled mock — see scripts/mock-llm.ts.)'
    );
    this.name = 'NoLlmKeyError';
  }
}

export function selectProvider(opts?: { model?: string }): LlmProvider {
  // ANTHROPIC_BASE_URL set without a key = the local mock path; treat the
  // (possibly empty) key as acceptable because the mock ignores it.
  const mockAnthropic = !!process.env.ANTHROPIC_BASE_URL;
  const mockOpenAi = !!process.env.OPENAI_BASE_URL;

  if (process.env.ANTHROPIC_API_KEY || mockAnthropic) return createAnthropicProvider(opts);
  if (process.env.OPENAI_API_KEY || mockOpenAi) return createOpenAiProvider(opts);
  throw new NoLlmKeyError();
}

// Non-throwing health summary for /healthz — reports whether the SDK harness
// would call a REAL model or a local mock, plus the active provider/model. Never
// returns the key itself.
export interface SdkHealth {
  available: boolean; // can the harness run at all (real key OR mock base URL)?
  real: boolean; // true only when a real API key is present (no base-URL override)
  provider: 'anthropic' | 'openai' | null;
  model: string | null;
  mode: 'real-key' | 'mock-base-url' | 'unconfigured';
}

export function describeSdk(): SdkHealth {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  const anthropicBase = !!process.env.ANTHROPIC_BASE_URL;
  const openAiBase = !!process.env.OPENAI_BASE_URL;

  try {
    const p = selectProvider();
    // "real" = a genuine key is present AND we're not pointed at a local mock.
    const real =
      (p.name === 'anthropic' && hasAnthropicKey && !anthropicBase) ||
      (p.name === 'openai' && hasOpenAiKey && !openAiBase);
    const usingMockBase =
      (p.name === 'anthropic' && anthropicBase) || (p.name === 'openai' && openAiBase);
    return {
      available: true,
      real,
      provider: p.name,
      model: p.model,
      mode: real ? 'real-key' : usingMockBase ? 'mock-base-url' : 'real-key',
    };
  } catch {
    return { available: false, real: false, provider: null, model: null, mode: 'unconfigured' };
  }
}
