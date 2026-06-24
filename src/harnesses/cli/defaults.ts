// src/harnesses/cli/defaults.ts
// Recommends the DEFAULT (harness, environment) pair so the user gets REAL
// generation with ZERO configuration. The rule (composition-root policy — lives
// outside the kernel):
//
//   1) An OpenAI-compatible API key set → `openai-agents` on docker.
//   2) No key, but a CLI     → a CLI-credential harness on the `local` env
//      login is present         (Hermes preferred, else Claude, else Codex). Real
//                               generation, no key.
//   3) Neither               → `none`/`none`: no runnable config. The UI must
//                               surface "set an API key or log into a CLI" — there
//                               is no offline demo harness.
//
// SECURITY: presence-only checks (see detect.ts) — no credential value is read.

import { detectClaude, detectCodex, detectHermes } from './detect.js';

export interface DefaultSelection {
  harness: string;
  environment: string;
  reason: string;
  // Diagnostic booleans for /registry (no secrets) — let the UI hint why.
  hasApiKey: boolean;
  hermes: { installed: boolean; loggedIn: boolean };
  claude: { installed: boolean; loggedIn: boolean };
  codex: { installed: boolean; loggedIn: boolean };
}

export function recommendDefaultsFromStatus(args: {
  hasApiKey: boolean;
  hermes: { installed: boolean; loggedIn: boolean };
  claude: { installed: boolean; loggedIn: boolean };
  codex: { installed: boolean; loggedIn: boolean };
}): DefaultSelection {
  const { hasApiKey, hermes, claude, codex } = args;
  if (hasApiKey) {
    return {
      harness: 'openai-agents',
      environment: 'docker',
      reason: 'API key present → openai-agents on docker',
      hasApiKey,
      hermes,
      claude,
      codex,
    };
  }
  if (hermes.installed && hermes.loggedIn) {
    return {
      harness: 'hermes-cli',
      environment: 'local',
      reason: 'No API key; Hermes CLI configured → hermes-cli on local (zero-key)',
      hasApiKey,
      hermes,
      claude,
      codex,
    };
  }
  if (claude.installed && claude.loggedIn) {
    return {
      harness: 'claude-cli',
      environment: 'local',
      reason: 'No API key; Claude CLI logged in → claude-cli on local (zero-key)',
      hasApiKey,
      hermes,
      claude,
      codex,
    };
  }
  if (codex.installed && codex.loggedIn) {
    return {
      harness: 'codex-cli',
      environment: 'local',
      reason: 'No API key; Codex CLI logged in → codex-cli on local (zero-key)',
      hasApiKey,
      hermes,
      claude,
      codex,
    };
  }
  return {
    harness: 'none',
    environment: 'none',
    reason: 'No API key and no CLI login → no runnable config (set a key or configure hermes/claude/codex)',
    hasApiKey,
    hermes,
    claude,
    codex,
  };
}

export function recommendDefaults(): DefaultSelection {
  const hasApiKey = !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
  const hermes = detectHermes();
  const claude = detectClaude();
  const codex = detectCodex();

  return recommendDefaultsFromStatus({
    hasApiKey,
    hermes,
    claude,
    codex,
  });
}
