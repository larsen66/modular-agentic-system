// src/server/sessionMemory.ts
// Lightweight durable memory for a session. This is intentionally separate from
// raw run history: history stores the full event stream; memory stores only the
// compact context worth feeding into the next turn.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunResult } from '../kernel/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MEMORY_FILE = path.resolve(HERE, '..', '..', '.history', 'session-memory.json');
const MAX_TURNS = 6;
const MAX_FIELD = 700;
const MAX_PROMPT_CONTEXT = 2_400;

export interface SessionTurnMemory {
  runId: string;
  prompt: string;
  outcome: string;
  finalText: string | null;
  at: number;
}

export interface SessionMemory {
  sessionId: string;
  ownerId: string;
  updatedAt: number;
  turns: SessionTurnMemory[];
  summary: string;
}

interface MemoryFile {
  version: 1;
  sessions: Record<string, SessionMemory>;
}

function memoryFilePath(): string {
  return process.env.SESSION_MEMORY_FILE || DEFAULT_MEMORY_FILE;
}

function key(ownerId: string, sessionId: string): string {
  return `${ownerId}:${sessionId}`;
}

function clip(value: string, limit = MAX_FIELD): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trimEnd()}...`;
}

function resultOutcome(result: RunResult): string {
  if (result.cause === 'error') {
    return `error${result.error?.code ? `:${result.error.code}` : ''}`;
  }
  return result.cause;
}

function buildSummary(turns: SessionTurnMemory[]): string {
  return turns
    .map((turn, index) => {
      const bits = [`${index + 1}. User: ${turn.prompt}`, `Outcome: ${turn.outcome}`];
      if (turn.finalText) bits.push(`Assistant: ${turn.finalText}`);
      return bits.join(' | ');
    })
    .join('\n');
}

async function readStore(): Promise<MemoryFile> {
  try {
    const raw = await readFile(memoryFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<MemoryFile>;
    if (parsed.version === 1 && parsed.sessions && typeof parsed.sessions === 'object') {
      return { version: 1, sessions: parsed.sessions as Record<string, SessionMemory> };
    }
  } catch {
    // Missing or corrupt memory should not block a live run.
  }
  return { version: 1, sessions: {} };
}

async function writeStore(store: MemoryFile): Promise<void> {
  const file = memoryFilePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function getSessionMemory(
  ownerId: string,
  sessionId: string
): Promise<SessionMemory | null> {
  const store = await readStore();
  return store.sessions[key(ownerId, sessionId)] ?? null;
}

export async function updateSessionMemory(input: {
  ownerId: string;
  sessionId: string;
  runId: string;
  prompt: string;
  result: RunResult;
}): Promise<SessionMemory> {
  const store = await readStore();
  const memoryKey = key(input.ownerId, input.sessionId);
  const previous = store.sessions[memoryKey];
  const turn: SessionTurnMemory = {
    runId: input.runId,
    prompt: clip(input.prompt),
    outcome: resultOutcome(input.result),
    finalText: input.result.finalText ? clip(input.result.finalText) : null,
    at: Date.now(),
  };
  const turns = [...(previous?.turns ?? []), turn].slice(-MAX_TURNS);
  const memory: SessionMemory = {
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    updatedAt: Date.now(),
    turns,
    summary: buildSummary(turns),
  };
  store.sessions[memoryKey] = memory;
  await writeStore(store);
  return memory;
}

export function promptWithSessionMemory(prompt: string, memory: SessionMemory | null): string {
  if (!memory || memory.turns.length === 0) return prompt;
  const context = clip(memory.summary, MAX_PROMPT_CONTEXT);
  return [
    'Previous context for this session:',
    context,
    '',
    'Current user request:',
    prompt,
  ].join('\n');
}
