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
import { resolveTopology } from '../src/kernel/capabilities.js';
import { loadOptionalAdapters } from '../src/server/bootstrap.js';
import type {
  DelegateRequest,
  DelegateResult,
  EngineEvent,
  EnvironmentHandle,
  ExecutionTopology,
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
// Default to gpt-4o-mini: anthropic-via-OpenRouter currently streams empty in
// pi-ai (provider routing to Bedrock returns no tokens) — an upstream flake, not
// a router-arch issue. Override with --model / PI_MODEL once that path is healthy.
const MODEL = getArg('model', process.env.PI_MODEL ?? 'openrouter/openai/gpt-4o-mini');

// ─── Test cases: user prompt → expected routing decision ─────────────────────
// `delegates` is the hard ground truth (binary, unambiguous). `isolated`/`harness`
// are SOFT signals reported but not hard-gated — "the right harness" is fuzzy and
// depends on the live catalog.
interface Case {
  name: string;
  prompt: string;
  delegates: boolean; // hard gate: should PI delegate at all?
  isolated?: boolean; // soft: when delegating, should the env be an isolated sandbox?
  // Expected RESOLVED topology for the delegated sub-run. Ground-truth rule:
  //   agent-as-tool   — bounded / one-shot side-effect work (run a script, build
  //                     once). Max isolation, agent reasons on control plane.
  //   agent-in-sandbox— stateful / long-lived dev: running a dev server and
  //                     iterating with live preview, the agent living in the env.
  // Soft axis (reported), only checked when the delegate call is otherwise valid.
  expectTopology?: ExecutionTopology;
  rationale: string;
}

// Policy under test: PI is a GENERALIST. It does ALL simple/normal work itself
// (even with side effects — file writes, small scripts, quick commands). It
// delegates ONLY when a specialized harness fits the task clearly better:
// large/complex builds, untrusted-code isolation, browser, etc.
const CASES: Case[] = [
  // ── SELF: PI handles it directly ──────────────────────────────────────────
  {
    name: 'trivial-fact',
    prompt: 'What is the capital of France? Answer in one word.',
    delegates: false,
    rationale: 'A one-word fact — answer directly.',
  },
  {
    name: 'trivial-math',
    prompt: 'What is 17 * 23? Just the number.',
    delegates: false,
    rationale: 'Pure arithmetic — answer inline.',
  },
  {
    name: 'simple-file-write',
    prompt: "Create a file notes.txt in the workspace containing the single line: todo: buy milk",
    delegates: false,
    rationale: 'A one-file write — simple side effect, PI does it itself (write/bash).',
  },
  {
    name: 'simple-code-edit',
    prompt: 'Write a small JavaScript function reverseString(s) that reverses a string, and save it to utils.js.',
    delegates: false,
    rationale: 'A tiny single-file script — well within PI; no specialized harness needed.',
  },
  // ── DELEGATE: a specialized harness fits clearly better ───────────────────
  {
    name: 'build-full-app',
    prompt:
      'Build a complete React todo app with Vite and Tailwind: multiple components, add/delete/' +
      'mark-complete, localStorage persistence, clean styling. Scaffold and implement the whole project.',
    delegates: true,
    isolated: true,
    rationale: 'Large multi-file app build — a dedicated coding agent fits better than PI doing it inline.',
  },
  {
    name: 'stateful-dev',
    prompt:
      'Scaffold a Next.js app, start the dev server, and keep iterating on the landing page ' +
      'with live preview — adjust layout and styles until it looks polished. Keep the server running.',
    delegates: true,
    isolated: true,
    expectTopology: 'agent-in-sandbox',
    rationale: 'Long stateful dev with a running server — specialized harness, agent-in-sandbox.',
  },
  {
    name: 'untrusted-exec',
    prompt:
      'A user uploaded an untrusted Python script. Run it safely in an isolated sandbox and report its output.',
    delegates: true,
    isolated: true,
    rationale: 'Untrusted code — needs sandbox isolation PI cannot give on its own → delegate.',
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

// ─── Delegate analysis: validity + resolved topology (source of truth) ───────
// Run PI's proposed (harness, env, topology) triple through the REAL machinery:
// unknown refs throw (→ invalid), and resolveTopology decides whether the
// topology is runnable on that (harness, env). This is exactly what the kernel
// does at delegate time, so "valid" here == "would actually run".
interface DelegateAnalysis {
  req: DelegateRequest;
  valid: boolean;
  resolved?: ExecutionTopology; // the topology the kernel would run
  reason: string;
}

function analyzeDelegate(req: DelegateRequest): DelegateAnalysis {
  let harnessCaps: ReturnType<typeof registry.resolveHarness>['capabilities'] | undefined;
  let envCaps: ReturnType<typeof registry.resolveEnvironment>['capabilities'] | undefined;
  try {
    harnessCaps = registry.resolveHarness(req.harness).capabilities;
  } catch {
    return { req, valid: false, reason: `unknown harness "${req.harness}"` };
  }
  try {
    envCaps = registry.resolveEnvironment(req.environment).capabilities;
  } catch {
    return { req, valid: false, reason: `unknown environment "${req.environment}"` };
  }
  const decision = resolveTopology(harnessCaps, envCaps, req.topology as ExecutionTopology | undefined);
  if (!decision.ok) return { req, valid: false, reason: decision.message };
  return { req, valid: true, resolved: decision.topology, reason: 'runnable' };
}

// ─── Scoring (multi-axis) ─────────────────────────────────────────────────────
// decision  — DELEGATE vs DIRECT (hard, every case)
// validity  — every delegate call is a runnable (harness, env, topology) triple
//             (hard, only when the case delegates)
// topology  — the resolved topology matches the case's expectTopology
//             (soft/reported, only when expectTopology is set AND the call is valid)
// Overall case pass = AND of the applicable axes.
interface Verdict {
  pass: boolean;
  decision: boolean;
  validity?: boolean;
  topology?: boolean;
  notes: string[];
}

function score(c: Case, t: Trace): Verdict {
  const notes: string[] = [];
  const didDelegate = t.delegateCalls.length > 0;

  const decision = didDelegate === c.delegates;
  notes.push(
    `decision: ${didDelegate ? 'DELEGATE' : 'DIRECT'} (expected ${c.delegates ? 'DELEGATE' : 'DIRECT'}) ${decision ? '✅' : '❌'}`,
  );

  let validity: boolean | undefined;
  let topology: boolean | undefined;

  if (c.delegates && didDelegate) {
    const analyses = t.delegateCalls.map(analyzeDelegate);
    // Dedup the printed lines (a runaway can repeat the same triple many times).
    const seen = new Set<string>();
    for (const a of analyses) {
      const key = `${a.req.harness}/${a.req.environment}/${a.req.topology ?? 'auto'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const iso = isolatedEnvs.has(a.req.environment);
      const isoTag = c.isolated ? (iso ? ' [isolated ✅]' : ' [NOT isolated ⚠️]') : '';
      const topTag = a.valid ? `→ ${a.resolved}` : `INVALID: ${a.reason}`;
      notes.push(`  ${a.req.harness} / ${a.req.environment} ${topTag}${isoTag}`);
    }
    if (t.delegateCalls.length > seen.size) {
      notes.push(`  (…${t.delegateCalls.length} delegate calls total, ${seen.size} distinct — runaway width ⚠️)`);
    }

    // Validity axis: ALL calls must be runnable.
    validity = analyses.every((a) => a.valid);
    notes.push(`  validity: ${validity ? 'all runnable ✅' : 'has unrunnable triple ❌'}`);

    // Topology axis: among valid calls, does the resolved topology match expectation?
    if (c.expectTopology) {
      const validResolved = analyses.filter((a) => a.valid).map((a) => a.resolved);
      const match = validResolved.length > 0 && validResolved.every((r) => r === c.expectTopology);
      topology = match;
      notes.push(
        `  topology: resolved [${[...new Set(validResolved)].join(', ') || 'none'}] vs expected ${c.expectTopology} ${match ? '✅' : '❌'}`,
      );
    }
  }

  if (!c.delegates && !didDelegate) {
    // Self case: PI must actually handle it — either answer (text) or act with its
    // own tools (write/edit/bash). Delegating here is already a decision-axis fail.
    const didSomething = Boolean(t.thinking.trim() || t.finalText.trim() || t.toolCalls.length > 0);
    if (!didSomething) {
      notes.push('  expected PI to handle it directly but it did nothing ❌');
      return { pass: false, decision: false, notes };
    }
    const how = t.toolCalls.length > 0 ? `[${[...new Set(t.toolCalls.map((x) => x.name))].join(', ')}]` : 'answered';
    notes.push(`  handled directly: ${how} ✅`);
  }

  const pass = decision && (validity ?? true) && (topology ?? true);
  return { pass, decision, validity, topology, notes };
}

// ─── Run the matrix (cases × loops) ──────────────────────────────────────────
let total = 0;
let passed = 0;
const perCase = new Map<string, { pass: number; runs: number }>();
// Per-axis tallies (denominator = how many runs the axis applied to).
const axis = {
  decision: { pass: 0, n: 0 },
  validity: { pass: 0, n: 0 },
  topology: { pass: 0, n: 0 },
};

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

    // Axis tallies (only count an axis on runs where it applied).
    axis.decision.n++;
    if (v.decision) axis.decision.pass++;
    if (v.validity !== undefined) {
      axis.validity.n++;
      if (v.validity) axis.validity.pass++;
    }
    if (v.topology !== undefined) {
      axis.topology.n++;
      if (v.topology) axis.topology.pass++;
    }

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
const pct = (a: { pass: number; n: number }): string =>
  a.n === 0 ? 'n/a' : `${a.pass}/${a.n} = ${((a.pass / a.n) * 100).toFixed(0)}%`;
console.log(`\n--- axes ---`);
console.log(`  decision (delegate vs direct):  ${pct(axis.decision)}`);
console.log(`  validity (runnable triple):     ${pct(axis.validity)}`);
console.log(`  topology (as-tool vs in-sandbox): ${pct(axis.topology)}`);
console.log(`\noverall: ${passed}/${total} = ${(rate * 100).toFixed(1)}%   gate: ${(GATE * 100).toFixed(0)}%`);

if (rate >= GATE) {
  console.log(`GATE PASS ✅\n`);
  process.exit(0);
} else {
  console.log(`GATE FAIL ❌ — tune the router preamble / delegate description and rerun.\n`);
  process.exit(1);
}
