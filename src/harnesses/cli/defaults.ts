// src/harnesses/cli/defaults.ts
// Recommends the DEFAULT (harness, environment) pair so the user gets REAL
// generation with ZERO configuration. The rule (composition-root policy — lives
// outside the kernel):
//
//   1) An OpenAI-compatible API key set → `openai-agents` on docker.
//   2) No key                           → `none`/`none`: no runnable config. The
//                                          UI must surface "set an API key" — there
//                                          is no offline demo harness.
//
// SECURITY: presence-only checks — no credential value is read.

export interface DefaultSelection {
  harness: string;
  environment: string;
  reason: string;
  // Diagnostic boolean for /registry (no secrets) — lets the UI hint why.
  hasApiKey: boolean;
}

export function recommendDefaultsFromStatus(args: { hasApiKey: boolean }): DefaultSelection {
  const { hasApiKey } = args;
  if (hasApiKey) {
    return {
      harness: 'openai-agents',
      environment: 'docker',
      reason: 'API key present → openai-agents on docker',
      hasApiKey,
    };
  }
  return {
    harness: 'none',
    environment: 'none',
    reason: 'No API key → no runnable config (set OPENROUTER_API_KEY or OPENAI_API_KEY)',
    hasApiKey,
  };
}

export function recommendDefaults(): DefaultSelection {
  const hasApiKey = !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
  return recommendDefaultsFromStatus({ hasApiKey });
}
