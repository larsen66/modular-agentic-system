import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyHarnessEnv, loadHarnessEnv, parseEnvContent } from '../src/server/harnessEnv.js';

const KEYS = [
  'E2B_API_KEY',
  'DAYTONA_API_KEY',
  'CSB_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_AGENTS_MODEL',
  'SDK_MODEL',
  'VERCEL_TOKEN',
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('harness env loading', () => {
  it('parses dotenv lines with comments, exports, and quoted values', () => {
    expect(
      parseEnvContent(`
        # ignored
        export E2B="e2b_test"
        Daytona='dtn_test'
        EMPTY=
      `)
    ).toEqual({ E2B: 'e2b_test', Daytona: 'dtn_test', EMPTY: '' });
  });

  it('loads later env files over earlier env files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'harness-env-'));
    const first = join(dir, '.harness.env');
    const second = join(dir, '.env');
    await writeFile(first, 'E2B=first\nOPENROUTER_API_KEY=first-router\n');
    await writeFile(second, 'E2B=second\nCSB_API_KEY=csb_test\n');

    expect(loadHarnessEnv([first, second])).toEqual({
      E2B: 'second',
      OPENROUTER_API_KEY: 'first-router',
      CSB_API_KEY: 'csb_test',
    });
  });

  it('maps friendly keys and configures OpenRouter without overriding explicit env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'harness-env-'));
    const file = join(dir, '.env');
    await writeFile(
      file,
      [
        'E2B=e2b_test',
        'Daytona=dtn_test',
        'Vercel=vercel_test',
        'CSB_API_KEY=csb_test',
        'OPENROUTER_API_KEY=router_test',
      ].join('\n')
    );
    process.env.OPENAI_API_KEY = 'explicit_openai';

    applyHarnessEnv([file]);

    expect(process.env.E2B_API_KEY).toBe('e2b_test');
    expect(process.env.DAYTONA_API_KEY).toBe('dtn_test');
    expect(process.env.CSB_API_KEY).toBe('csb_test');
    expect(process.env.VERCEL_TOKEN).toBe('vercel_test');
    expect(process.env.OPENROUTER_API_KEY).toBe('router_test');
    expect(process.env.OPENAI_API_KEY).toBe('explicit_openai');
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(process.env.OPENAI_AGENTS_MODEL).toBe('openai/gpt-4o-mini');
  });
});
