// scripts/eval-router.ts
// Routing eval for PI-as-main-agent. For each user prompt we run PI's REAL agent
// loop (real model) but stub the Delegator with a recorder, so we observe PI's
// JUDGMENT — does it answer trivially, or delegate, and to which (harness, env)?
// — without paying for real sub-runs (no containers, no opencode build).
//
// "How PI thinks" = the assistant text it streams. "What it does" = the ordered
// tool calls, especially `delegate({ harness, environment, task })`.
//
// Self-skips loudly (exit 2) when the pi SDK or an API key is absent — same
// contract as src/harnesses/pi/verify.ts.
//
// Run:
//   npx tsx scripts/eval-router.ts                 # 1 pass, gate 0.8
//   npx tsx scripts/eval-router.ts --loops 3       # stability over 3 passes
//   npx tsx scripts/eval-router.ts --gate 0.9 --timeout 45000
//   PI_MODEL=openrouter/anthropic/claude-sonnet-4.5 npx tsx scripts/eval-router.ts

import { registry } from '../src/registry/index.js';
import { Kernel } from '../src/kernel/index.js';
import { loadOptionalAdapters } from '../src/server/bootstrap.js';
import type {
  DelegateRequest,
  DelegateResult,
  EngineEvent,
  EnvironmentHandle,
  HarnessEnvCatalog,
  RunContext,
} from '../src/types/index.js';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const LOOPS = Math.max(1, parseInt(getArg('loops', '1'), 10));
const GATE = parseFloat(getArg('gate', '0.8'));
const TIMEOUT_MS = parseInt(getArg('timeout', '60000'), 10);
const MODEL = getArg('model', process.env.PI_MODEL ?? 'openrouter/anthropic/claude-sonnet-4.5');

// ─── Test cases: user prompt → expected routing decision ─────────────────────
// `delegates` is the hard ground truth (binary, unambiguous). `isolated`/`harness`
// are SOFT signals reported but not hard-gated — "the right harness" is fuzzy and
// depends on the live catalog.
interface Case {
  name: string;
  prompt: string;
  delegates: boolean; // hard gate: should PI delegate at all?
  isolated?: boolean; // soft: when delegating, should the env be an isolated sandbox?
  rationale: string;
}

const CASES: Case[] = [
  {
    name: 'trivial-fact',
    prompt: 'What is the capital of France? Answer in one word.',
    delegates: false,
    rationale: 'A one-word fact — PI must answer directly, never delegate.',
  },
  {
    name: 'trivial-math',
    prompt: 'What is 17 * 23? Just the number.',
    delegates: false,
    rationale: 'Pure arithmetic — answer inline.',
  },
  {
    name: 'concept-explain',
    prompt: 'Briefly explain the difference between TCP and UDP.',
    delegates: false,
    rationale: 'Knowledge question — no tools, no sub-agent.',
  },
  {
    name: 'build-react-app',
    prompt:
      'Build a React todo app with Vite and Tailwind: add, delete, and mark-complete, ' +
      'persisted to localStorage. Scaffold the project and implement it.',
    delegates: true,
    isolated: true,
    rationale: 'A real build — delegate to a build-capable harness in an isolated env.',
  },
  {
    name: 'sandbox-exec',
    prompt:
      'Run a Python script that computes the 100th Fibonacci number and report the exact value.',
    delegates: true,
    isolated: true,
    rationale: 'Untrusted code execution — delegate into a sandbox.',
  },
];

// ─── Prereq checks (self-skip) ───────────────────────────────────────────────
const MISSING: string[] = [];
try {
  await import('@mariozechner/pi-coding-agent' as string);
} catch {
  MISSING.push('@mariozechner/pi-coding-agent not installed');
}
const hasKey =
  !!process.env.OPENROUTER_API_KEY || !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
if (!hasKey) MISSING.push('No API key (OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)');

if (MISSING.length > 0) {
  console.error('\n=== SKIP — router eval: prerequisites not met ===');
  for (const m of MISSING) console.error(`  • ${m}`);
  console.error('=================================================\n');
  process.exit(2);
}

// ─── Setup: load adapters, capture the live routing catalog ──────────────────
await import('../src/harnesses/pi/index.js'); // eager pi (also done by bootstrap)
await loadOptionalAdapters(); // opencode / claude-agent-sdk / openai-agents / managed envs
const catalog: HarnessEnvCatalog = new Kernel().describeTopologies();
const isolatedEnvs = new Set(
  catalog.environments.filter((e) => e.ref !== 'local').map((e) => e.ref),
); // every non-local env is treated as an isolated sandbox for scoring

const harness = registry.resolveHarness('pi');

console.log(`\n=== PI Router Eval ===`);
console.log(`model:   ${MODEL}`);
console.log(`loops:   ${LOOPS}   gate: ${GATE}   timeout: ${TIMEOUT_MS}ms`);
console.log(`catalog: harnesses=[${catalog.harnesses.map((h) => h.ref).join(', ')}]`);
console.log(`         environments=[${catalog.environments.map((e) => e.ref).join(', ')}]\n`);

// ─── Dummy env: PI's env-routed coding tools resolve here (benign no-ops) ─────
const dummyEnv = {
  id: 'eval-dummy',
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
  async writeFiles() {},
  async readFile() {
    return null;
  },
  async exposePort(port: number) {
    return { url: `http://localhost:${port}` };
  },
  async destroy() {},
} as unknown as EnvironmentHandle;

// ─── One run = one prompt through PI's real loop with a recording delegate ───
interface Trace {
  thinking: string; // concatenated streamed assistant text
  finalText: string; // the agent_end final_text (some answers arrive only here)
  toolCalls: { name: string; args: unknown }[];
  delegateCalls: DelegateRequest[];
  terminalCause: string;
}

async function runCase(prompt: string, runId: string): Promise<Trace> {
  const trace: Trace = { thinking: '', finalText: '', toolCalls: [], delegateCalls: [], terminalCause: 'none' };

  // Recording stub: capture the routing decision, return a canned success so PI
  // continues its loop as if the sub-agent had finished.
  const delegate = async (req: DelegateRequest): Promise<DelegateResult> => {
    trace.delegateCalls.push(req);
    return {
      cause: 'done',
      finalText: `[stub] ${req.harness}/${req.environment} completed: ${req.task.slice(0, 80)}`,
    };
  };
  const ctx: RunContext = { delegate, depth: 0, catalog };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  await harness.run(
    { runId, prompt, model: MODEL, topology: 'agent-as-tool', signal: controller.signal },
    dummyEnv,
    {
      emit(ev: EngineEvent) {
        if (ev.type === 'stream_chunk') trace.thinking += ev.text;
        else if (ev.type === 'final_text') trace.finalText = ev.text;
        else if (ev.type === 'tool_call') trace.toolCalls.push({ name: ev.name, args: ev.args });
        else if (ev.type === 'terminal') trace.terminalCause = ev.cause;
      },
    },
    undefined,
    ctx,
  );
  clearTimeout(timer);
  return trace;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
interface Verdict {
  pass: boolean;
  notes: string[];
}

function score(c: Case, t: Trace): Verdict {
  const notes: string[] = [];
  const didDelegate = t.delegateCalls.length > 0;

  let pass = didDelegate === c.delegates;
  notes.push(
    `decision: ${didDelegate ? 'DELEGATE' : 'DIRECT'} (expected ${c.delegates ? 'DELEGATE' : 'DIRECT'}) ${pass ? '✅' : '❌'}`,
  );

  if (c.delegates && didDelegate) {
    for (const d of t.delegateCalls) {
      const iso = isolatedEnvs.has(d.environment);
      notes.push(`  → ${d.harness} / ${d.environment}${c.isolated ? (iso ? ' [isolated ✅]' : ' [NOT isolated ⚠️]') : ''}`);
    }
  }
  if (!c.delegates && !didDelegate && !(t.thinking.trim() || t.finalText.trim())) {
    pass = false;
    notes.push('  expected a direct answer but PI produced no text ❌');
  }
  return { pass, notes };
}

// ─── Run the matrix (cases × loops) ──────────────────────────────────────────
let total = 0;
let passed = 0;
const perCase = new Map<string, { pass: number; runs: number }>();

for (let loop = 0; loop < LOOPS; loop++) {
  if (LOOPS > 1) console.log(`\n────────── loop ${loop + 1}/${LOOPS} ──────────`);
  for (const c of CASES) {
    total++;
    let trace: Trace;
    try {
      trace = await runCase(c.prompt, `eval-${c.name}-${loop}`);
    } catch (err) {
      console.log(`\n[${c.name}] ERROR: ${err instanceof Error ? err.message : String(err)}`);
      perCase.set(c.name, {
        pass: perCase.get(c.name)?.pass ?? 0,
        runs: (perCase.get(c.name)?.runs ?? 0) + 1,
      });
      continue;
    }
    const v = score(c, trace);
    if (v.pass) passed++;
    const agg = perCase.get(c.name) ?? { pass: 0, runs: 0 };
    agg.runs++;
    if (v.pass) agg.pass++;
    perCase.set(c.name, agg);

    console.log(`\n[${c.name}] ${v.pass ? 'PASS' : 'FAIL'}  — ${c.rationale}`);
    console.log(`  prompt:   "${c.prompt.slice(0, 90)}${c.prompt.length > 90 ? '…' : ''}"`);
    const think = (trace.thinking.trim() || trace.finalText.trim()).replace(/\s+/g, ' ');
    console.log(`  thinks:   ${think ? `"${think.slice(0, 160)}${think.length > 160 ? '…' : ''}"` : '(no text)'}`);
    console.log(
      `  does:     [${trace.toolCalls.map((tc) => tc.name).join(', ') || 'no tool calls'}]  (terminal: ${trace.terminalCause})`,
    );
    for (const n of v.notes) console.log(`  ${n}`);
  }
}

// ─── Summary + gate ──────────────────────────────────────────────────────────
const rate = total > 0 ? passed / total : 0;
console.log(`\n=== Summary ===`);
for (const [name, agg] of perCase) {
  console.log(`  ${name.padEnd(20)} ${agg.pass}/${agg.runs}`);
}
console.log(`\noverall: ${passed}/${total} = ${(rate * 100).toFixed(1)}%   gate: ${(GATE * 100).toFixed(0)}%`);

if (rate >= GATE) {
  console.log(`GATE PASS ✅\n`);
  process.exit(0);
} else {
  console.log(`GATE FAIL ❌ — tune the router preamble / delegate description and rerun.\n`);
  process.exit(1);
}
