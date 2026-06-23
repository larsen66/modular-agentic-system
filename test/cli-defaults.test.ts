import { describe, expect, it } from 'vitest';
import { recommendDefaultsFromStatus } from '../src/harnesses/cli/defaults.js';

const absent = { installed: false, loggedIn: false };
const ready = { installed: true, loggedIn: true };

describe('CLI harness default selection', () => {
  it('prefers the SDK harness when an API key is present', () => {
    expect(
      recommendDefaultsFromStatus({
        hasApiKey: true,
        hermes: ready,
        claude: ready,
        codex: ready,
      }).harness
    ).toBe('sdk');
  });

  it('prefers Hermes among zero-key CLI harnesses', () => {
    expect(
      recommendDefaultsFromStatus({
        hasApiKey: false,
        hermes: ready,
        claude: ready,
        codex: ready,
      })
    ).toMatchObject({ harness: 'hermes-cli', environment: 'local' });
  });

  it('falls back through Claude then Codex when Hermes is unavailable', () => {
    expect(
      recommendDefaultsFromStatus({
        hasApiKey: false,
        hermes: absent,
        claude: ready,
        codex: ready,
      }).harness
    ).toBe('claude-cli');
    expect(
      recommendDefaultsFromStatus({
        hasApiKey: false,
        hermes: absent,
        claude: absent,
        codex: ready,
      }).harness
    ).toBe('codex-cli');
  });
});
