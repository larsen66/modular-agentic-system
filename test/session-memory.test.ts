import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunResult } from '../src/kernel/index.js';
import {
  getSessionMemory,
  promptWithSessionMemory,
  updateSessionMemory,
} from '../src/server/sessionMemory.js';

const result = (runId: string, finalText: string): RunResult => ({
  runId,
  cause: 'done',
  finalText,
  usage: { inputTokens: 10, outputTokens: 5 },
  cost: 0,
});

let savedMemoryFile: string | undefined;

beforeEach(async () => {
  savedMemoryFile = process.env.SESSION_MEMORY_FILE;
  const dir = await mkdtemp(join(tmpdir(), 'session-memory-'));
  process.env.SESSION_MEMORY_FILE = join(dir, 'memory.json');
});

afterEach(() => {
  if (savedMemoryFile === undefined) delete process.env.SESSION_MEMORY_FILE;
  else process.env.SESSION_MEMORY_FILE = savedMemoryFile;
});

describe('session memory', () => {
  it('creates compact owner-scoped memory and injects it into the next prompt', async () => {
    const memory = await updateSessionMemory({
      ownerId: 'owner-a',
      sessionId: 'session-1',
      runId: 'run-1',
      prompt: 'Build a CRM dashboard with a table view.',
      result: result('run-1', 'Live preview ready at http://localhost:5173'),
    });

    expect(memory.summary).toContain('Build a CRM dashboard');
    expect(memory.summary).toContain('Outcome: done');

    const loaded = await getSessionMemory('owner-a', 'session-1');
    expect(loaded?.turns).toHaveLength(1);

    const prompt = promptWithSessionMemory('Now add filters.', loaded);
    expect(prompt).toContain('Previous context for this session:');
    expect(prompt).toContain('Build a CRM dashboard');
    expect(prompt).toContain('Current user request:');
    expect(prompt).toContain('Now add filters.');
  });

  it('does not leak memory across owners sharing a session id', async () => {
    await updateSessionMemory({
      ownerId: 'owner-a',
      sessionId: 'shared-session',
      runId: 'run-1',
      prompt: 'Private request',
      result: result('run-1', 'Private answer'),
    });

    expect(await getSessionMemory('owner-b', 'shared-session')).toBeNull();
  });

  it('keeps only the latest turns', async () => {
    for (let i = 0; i < 8; i++) {
      await updateSessionMemory({
        ownerId: 'owner-a',
        sessionId: 'session-1',
        runId: `run-${i}`,
        prompt: `Request ${i}`,
        result: result(`run-${i}`, `Answer ${i}`),
      });
    }

    const memory = await getSessionMemory('owner-a', 'session-1');
    expect(memory?.turns).toHaveLength(6);
    expect(memory?.summary).not.toContain('Request 0');
    expect(memory?.summary).toContain('Request 7');
  });
});
