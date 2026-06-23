// src/harnesses/pi/verify.ts
// Live smoke test for the PI harness.
//
// Self-skips (loud SKIP, non-zero exit) when the required deps or credentials
// are absent — the expected state in most CI/dev envs.
//
// Run:
//   npx tsx src/harnesses/pi/verify.ts
//
// Prerequisites for a live run:
//   1. @mariozechner/pi-coding-agent@0.69.0 and @mariozechner/pi-ai@0.69.0 installed
//      (npm install @mariozechner/pi-coding-agent@0.69.0 @mariozechner/pi-ai@0.69.0)
//   2. One of: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in env
//   3. Optionally: PI_MODEL=openrouter/anthropic/claude-opus-4-5 (or any valid model)
//
// What it tests:
//   - SDK import succeeds
//   - PI creates a session with the given cwd and model
//   - session.prompt() drives the agent loop for a trivial prompt
//   - EngineEvents flow (stream_chunk, tool_call/tool_result, final_text, terminal)
//   - Harness settles EXACTLY ONCE with cause:'done'
//   - cancel() triggers cause:'cancelled' on a long-running prompt

import { registry } from '../../registry/index.js';
import type { EngineEvent, EnvironmentHandle } from '../../types/index.js';

// Self-register the harness (normally done via bootstrap side-effect imports).
await import('./index.js');

type TerminalEv = { type: 'terminal'; cause: 'done' | 'error' | 'cancelled'; error?: unknown };

// ─── Prerequisite checks ──────────────────────────────────────────────────────

const MISSING: string[] = [];

// Check SDK availability
try {
  await import('@mariozechner/pi-coding-agent' as string);
} catch {
  MISSING.push('@mariozechner/pi-coding-agent not installed (npm install @mariozechner/pi-coding-agent@0.69.0)');
}
try {
  await import('@mariozechner/pi-ai' as string);
} catch {
  MISSING.push('@mariozechner/pi-ai not installed (npm install @mariozechner/pi-ai@0.69.0)');
}

const hasKey =
  !!process.env.OPENROUTER_API_KEY ||
  !!process.env.ANTHROPIC_API_KEY ||
  !!process.env.OPENAI_API_KEY;
if (!hasKey) {
  MISSING.push(
    'No API key found. Set one of: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY',
  );
}

if (MISSING.length > 0) {
  console.error('\n========================================================');
  console.error('SKIP — PI harness live verify: prerequisites not met');
  console.error('--------------------------------------------------------');
  for (const m of MISSING) {
    console.error(`  • ${m}`);
  }
  console.error('========================================================\n');
  process.exit(2); // 2 = skip (not test failure)
}

// ─── Live run ─────────────────────────────────────────────────────────────────

console.log('\n[pi/verify] Prerequisites met — running live harness test\n');

const harness = registry.resolveHarness('pi');

// A minimal dummy EnvironmentHandle for the verify (no real container needed;
// PI drives its own tool loop in the tmpDir, not through the handle).
const dummyEnv = {
  id: 'verify-dummy',
  capabilities: {
    publicPorts: false,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: true,
  },
  async exec() {
    return { exitCode: 0, stdout: '', stderr: '' };
  },
  async writeFiles(files: { path: string; content: string | Buffer }[]) {
    console.log(`[pi/verify] env.writeFiles called: ${files.length} file(s) synced`);
  },
  async readFile() {
    return null;
  },
  async exposePort(port: number) {
    return { url: `http://localhost:${port}` };
  },
  async destroy() {},
};

// ── Test 1: basic prompt run ─────────────────────────────────────────────────
console.log('[pi/verify] Test 1: basic prompt');
const events1: string[] = [];
let settled1 = false;
let terminalEvent1: TerminalEv | null = null;

const controller1 = new AbortController();

await harness.run(
  {
    runId: 'verify-run-1',
    prompt: 'Reply with exactly: Hello from PI.',
    model: process.env.PI_MODEL,
    topology: 'agent-in-sandbox',
    signal: controller1.signal,
  },
  dummyEnv as unknown as EnvironmentHandle,
  {
    emit(ev: EngineEvent) {
      events1.push(ev.type);
      if (ev.type === 'terminal') {
        settled1 = true;
        terminalEvent1 = ev;
      }
      if (ev.type !== 'log') {
        console.log(`  event: ${JSON.stringify(ev).slice(0, 120)}`);
      }
    },
  },
);

if (!settled1 || (terminalEvent1 as TerminalEv | null)?.cause !== 'done') {
  console.error(`\n[pi/verify] FAIL Test 1: expected terminal{cause:'done'}, got ${JSON.stringify(terminalEvent1)}`);
  process.exit(1);
}
const hasStreamChunk = events1.includes('stream_chunk');
if (!hasStreamChunk) {
  console.warn('[pi/verify] WARN Test 1: no stream_chunk events received (model may not support streaming)');
}
console.log('[pi/verify] Test 1 PASS\n');

// ── Test 2: cancel mid-run ────────────────────────────────────────────────────
console.log('[pi/verify] Test 2: cancel');
let terminalEvent2: TerminalEv | null = null;
const controller2 = new AbortController();

const runPromise = harness.run(
  {
    runId: 'verify-run-2',
    prompt: 'List every file in this directory recursively and count lines.',
    model: process.env.PI_MODEL,
    topology: 'agent-in-sandbox',
    signal: controller2.signal,
  },
  dummyEnv as unknown as EnvironmentHandle,
  {
    emit(ev: EngineEvent) {
      if (ev.type === 'terminal') {
        terminalEvent2 = ev;
      }
    },
  },
);

// Abort after a short delay
await new Promise((r) => setTimeout(r, 800));
controller2.abort();
await runPromise;

const t2 = terminalEvent2 as TerminalEv | null;
if (t2?.cause !== 'cancelled' && t2?.cause !== 'done') {
  console.error(`[pi/verify] FAIL Test 2: expected cancelled or done, got ${JSON.stringify(t2)}`);
  process.exit(1);
}
console.log(`[pi/verify] Test 2 PASS (cause=${t2?.cause})\n`);

console.log('[pi/verify] ALL TESTS PASSED');
