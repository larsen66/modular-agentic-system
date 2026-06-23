// test/provider-select.test.ts
// Unit-level proof of provider auto-detection (no network, no key needed).
// Verifies: ANTHROPIC wins when both keys set; OpenAI used when only its key is
// set; a base-URL (mock) counts as "available"; and NoLlmKeyError when neither.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { selectProvider, NoLlmKeyError } from '../src/harnesses/sdk/providers/index.js';

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_BASE_URL', 'OPENAI_BASE_URL'];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('SDK harness provider selection', () => {
  it('prefers Anthropic when both keys are present', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-x';
    process.env.OPENAI_API_KEY = 'sk-oai-x';
    expect(selectProvider().name).toBe('anthropic');
  });

  it('uses OpenAI when only OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-oai-x';
    expect(selectProvider().name).toBe('openai');
  });

  it('treats ANTHROPIC_BASE_URL (mock) as available even without a key', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8787';
    expect(selectProvider().name).toBe('anthropic');
  });

  it('throws NoLlmKeyError when neither key nor base URL is present', () => {
    expect(() => selectProvider()).toThrow(NoLlmKeyError);
  });
});
