// scripts/lib/piEvalHarness.ts
// Importable PI routing-accuracy eval. Runs PI's REAL agent loop (real model) with
// a STUBBED delegate recorder, so we observe PI's JUDGMENT (self vs delegate, and
// to which harness/env) without paying for real sub-runs. Returns STRUCTURED
// per-turn results so the auto-fix loop (eval-pi-improve.ts) can see exactly which
// turns failed and feed them back to the policy-revision model.
//
// This is the in-process scorer; it imports the live registry/kernel so the
// delegate triples it validates are the same ones the kernel would run.

import { registry } from '../../src/registry/index.js';
import { Kernel } from '../../src/kernel/index.js';
import { resolveTopology } from '../../src/kernel/capabilities.js';
import { loadOptionalAdapters } from '../../src/server/bootstrap.js';
import type {
  DelegateRequest,
  DelegateResult,
  EngineEvent,
  EnvironmentHandle,
  ExecutionTopology,
  HarnessEnvCatalog,
  RunContext,
} from '../../src/types/index.js';
import { ROUTER_CASES, SCENARIOS, type Decision } from './piEvalCases.js';

export interface TurnResult {
  id: string; // stable id: "router/<name>" | "<scenario>/<turnIndex>"
  group: string; // scenario or "router"
  prompt: string;
  expect: Decision;
  got: Decision;
  pass: boolean;
  delegateTargets: string[]; // "harness/env" strings PI proposed
  invalidDelegate?: string; // reason a proposed triple is unrunnable, if any
  toolCalls: string[];
  why: string;
  difficulty?: string;
}

export interface EvalResult {
  model: string;
  rate: number; // 0..1 routing accuracy across all scored turns
  passed: number;
  total: number;
  results: TurnResult[];
  byGroup: { group: string; pass: number; turns: number }[];
}

export interface EvalOpts {
  model?: string;
  timeoutMs?: number;
  includeRouterCases?: boolean;
  includeScenarios?: boolean;
  onTurn?: (r: TurnResult) => void;
}

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

interface RawTurn {
  delegated: boolean;
  delegateReqs: DelegateRequest[];
  toolCalls: string[];
  assistantText: string;
}

function delegateValid(req: DelegateRequest): { valid: boolean; reason: string } {
  let hc, ec;
  try {
    hc = registry.resolveHarness(req.harness).capabilities;
  } catch {
    return { valid: false, reason: `unknown harness "${req.harness}"` };
  }
  try {
    ec = registry.resolveEnvironment(req.environment).capabilities;
  } catch {
    return { valid: false, reason: `unknown env "${req.environment}"` };
  }
  const d = resolveTopology(hc, ec, req.topology as ExecutionTopology | undefined);
  return d.ok ? { valid: true, reason: 'runnable' } : { valid: false, reason: d.message };
}

// Run ONE prompt (optionally with prior transcript) through PI's real loop.
async function runPrompt(
  harness: ReturnType<typeof registry.resolveHarness>,
  catalog: HarnessEnvCatalog,
  history: { role: string; content: string }[],
  user: string,
  runId: string,
  model: string,
  timeoutMs: number,
): Promise<RawTurn> {
  const res: RawTurn = { delegated: false, delegateReqs: [], toolCalls: [], assistantText: '' };
  const delegate = async (req: DelegateRequest): Promise<DelegateResult> => {
    res.delegateReqs.push(req);
    res.delegated = true;
    return { cause: 'done', finalText: `[stub] ${req.harness}/${req.environment} completed: ${req.task.slice(0, 80)}` };
  };
  const ctx: RunContext = { delegate, depth: 0, catalog };

  const transcript = history.length
    ? 'Conversation so far:\n' +
      history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') +
      '\n\n'
    : '';
  const prompt = `${transcript}Current user message: ${user}`;

  let streamed = '';
  let final = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await harness.run(
      { runId, prompt, model, topology: 'agent-as-tool', signal: controller.signal },
      dummyEnv,
      {
        emit(ev: EngineEvent) {
          if (ev.type === 'stream_chunk') streamed += ev.text;
          else if (ev.type === 'final_text') final = ev.text;
          else if (ev.type === 'tool_call' && ev.name !== 'delegate') res.toolCalls.push(ev.name);
        },
      },
      undefined,
      ctx,
    );
  } finally {
    clearTimeout(timer);
  }
  res.assistantText = (final || streamed).trim();
  return res;
}

function scoreTurn(
  id: string,
  group: string,
  prompt: string,
  expect: Decision,
  why: string,
  raw: RawTurn,
  difficulty?: string,
): TurnResult {
  const got: Decision = raw.delegated ? 'delegate' : 'self';
  const decisionOk = got === expect;
  // A self turn must actually act (answer or use a tool); a delegate turn must
  // produce at least one runnable triple.
  let invalidDelegate: string | undefined;
  if (raw.delegated) {
    const v = delegateValid(raw.delegateReqs[0]);
    if (!v.valid) invalidDelegate = v.reason;
  }
  const didSomething = Boolean(raw.assistantText || raw.toolCalls.length > 0);
  const pass = decisionOk && (expect === 'delegate' ? !invalidDelegate : didSomething);
  return {
    id,
    group,
    prompt,
    expect,
    got,
    pass,
    delegateTargets: raw.delegateReqs.map((r) => `${r.harness}/${r.environment}${r.topology ? `/${r.topology}` : ''}`),
    invalidDelegate,
    toolCalls: [...new Set(raw.toolCalls)],
    why,
    difficulty,
  };
}

export async function runRoutingEval(opts: EvalOpts = {}): Promise<EvalResult> {
  const model = opts.model ?? process.env.PI_MODEL ?? 'openrouter/openai/gpt-4o-mini';
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const includeRouterCases = opts.includeRouterCases ?? true;
  const includeScenarios = opts.includeScenarios ?? true;

  await import('../../src/harnesses/pi/index.js');
  await loadOptionalAdapters();
  const catalog = new Kernel().describeTopologies();
  const harness = registry.resolveHarness('pi');

  const results: TurnResult[] = [];

  if (includeRouterCases) {
    for (const c of ROUTER_CASES) {
      const raw = await runPrompt(harness, catalog, [], c.prompt, `router-${c.name}`, model, timeoutMs).catch(
        () => ({ delegated: false, delegateReqs: [], toolCalls: [], assistantText: '' }) as RawTurn,
      );
      const r = scoreTurn(`router/${c.name}`, 'router', c.prompt, c.expect, c.rationale, raw, c.difficulty);
      results.push(r);
      opts.onTurn?.(r);
    }
  }

  if (includeScenarios) {
    for (const sc of SCENARIOS) {
      const history: { role: string; content: string }[] = [];
      for (let i = 0; i < sc.turns.length; i++) {
        const turn = sc.turns[i];
        const raw = await runPrompt(harness, catalog, history, turn.user, `scn-${sc.name}-${i}`, model, timeoutMs).catch(
          () => ({ delegated: false, delegateReqs: [], toolCalls: [], assistantText: '' }) as RawTurn,
        );
        const r = scoreTurn(`${sc.name}/${i}`, sc.name, turn.user, turn.expect, turn.why, raw, turn.difficulty);
        results.push(r);
        opts.onTurn?.(r);
        history.push({ role: 'user', content: turn.user });
        const asst = raw.delegated
          ? `[delegated to ${raw.delegateReqs[0]?.harness ?? 'sub-agent'}: done]`
          : raw.assistantText || '[handled with tools]';
        history.push({ role: 'assistant', content: asst.slice(0, 240) });
      }
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const groups = [...new Set(results.map((r) => r.group))];
  const byGroup = groups.map((g) => ({
    group: g,
    pass: results.filter((r) => r.group === g && r.pass).length,
    turns: results.filter((r) => r.group === g).length,
  }));

  return { model, rate: total ? passed / total : 0, passed, total, results, byGroup };
}

// Prereq probe so callers can self-skip with a clear message.
export async function checkPrereqs(): Promise<string[]> {
  const missing: string[] = [];
  try {
    await import('@mariozechner/pi-coding-agent' as string);
  } catch {
    missing.push('@mariozechner/pi-coding-agent not installed');
  }
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    missing.push('No API key (OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)');
  }
  return missing;
}
