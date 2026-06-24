// scripts/eval-pi-improve.ts
// CLOSED auto-fix loop for PI routing accuracy.
//
//   measure → if below gate: feed FAILING turns + the current router policy to a
//   fixer model → it rewrites src/harnesses/pi/routerPolicy.ts (the single tunable
//   knob) → typecheck the candidate → re-measure → KEEP if accuracy improved, else
//   REVERT → repeat until the gate passes or --max-iters is exhausted.
//
// Safety:
//   • Edits ONLY routerPolicy.ts. The original is backed up and the BEST-scoring
//     version is restored on exit (success, gate-fail, error, or Ctrl-C).
//   • A candidate that fails typecheck or drops accuracy is rejected (reverted).
//   • NEVER commits, pushes, or deploys. Pure local file iteration.
//
// Cost: each measure pass runs PI's real loop over ~7 router cases + ~25 scenario
// turns. Scope with --router-only / --scenarios-only / --max-iters to control spend.
//
// Run:
//   npx tsx --env-file=.env scripts/eval-pi-improve.ts --gate 0.9 --max-iters 3
//   npx tsx --env-file=.env scripts/eval-pi-improve.ts --measure-only
//   npx tsx --env-file=.env scripts/eval-pi-improve.ts --router-only --fixer-model openrouter/anthropic/claude-sonnet-4.5

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runRoutingEval, checkPrereqs, type EvalResult, type TurnResult } from './lib/piEvalHarness.js';

// ─── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const getArg = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const GATE = parseFloat(getArg('gate', '0.9'));
const MAX_ITERS = Math.max(0, parseInt(getArg('max-iters', '3'), 10));
const TIMEOUT_MS = parseInt(getArg('timeout', '60000'), 10);
const PI_MODEL = getArg('model', process.env.PI_MODEL ?? 'openrouter/openai/gpt-4o-mini');
const FIXER_MODEL = getArg('fixer-model', process.env.FIXER_MODEL ?? 'openrouter/anthropic/claude-sonnet-4.5');
const MEASURE_ONLY = has('--measure-only');
const includeRouterCases = !has('--scenarios-only');
const includeScenarios = !has('--router-only');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const POLICY_PATH = path.join(ROOT, 'src', 'harnesses', 'pi', 'routerPolicy.ts');
const OUT_DIR = path.join(ROOT, 'docs-evidence', 'pi-improve');
// Exported names that MUST survive any rewrite (the loop's structural contract).
const REQUIRED_EXPORTS = [
  'buildRouterPreamble',
  'HARNESS_PURPOSE',
  'renderDelegateDescription',
  'HARNESS_PARAM_DESC',
  'ENVIRONMENT_PARAM_DESC',
  'TASK_PARAM_DESC',
  'MODEL_PARAM_DESC',
  'TOPOLOGY_FIELD_DESCRIPTION',
];

const GROUND_TRUTH =
  'PI is a GENERALIST that OPERATES the business app itself — answers, queries, data ops, ' +
  'role/access config, governed edits, rollback, audit, and small single-file changes are all ' +
  'SELF (do NOT delegate). PI DELEGATES only heavy GENERATION or specialized work: scaffolding a ' +
  'template/app from intent, importing+rebuilding a repo, large multi-file customization, running ' +
  'untrusted code in an isolated sandbox, or a capability a sub-agent is purpose-built for (e.g. ' +
  'browser automation). Misleading phrasing must be seen through: "sounds big but is a restyle" → ' +
  'SELF; "sounds casual but is a full build" → DELEGATE.';

// ─── typecheck a candidate (fast: just this build's tsc) ─────────────────────
function typechecks(): { ok: boolean; output: string } {
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

// ─── fixer model call (OpenRouter / OpenAI-compatible chat completions) ──────
async function callFixer(currentPolicy: string, failures: TurnResult[]): Promise<string> {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  const base = orKey
    ? 'https://openrouter.ai/api/v1'
    : process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const key = orKey || oaKey;
  if (!key) throw new Error('fixer needs OPENROUTER_API_KEY or OPENAI_API_KEY');
  // Strip the leading "openrouter/" provider prefix for the API model id.
  const apiModel = FIXER_MODEL.replace(/^openrouter\//, '');

  const failBlock = failures
    .map(
      (f) =>
        `- [${f.group}] expected ${f.expect.toUpperCase()}, PI chose ${f.got.toUpperCase()}` +
        `${f.invalidDelegate ? ` (invalid triple: ${f.invalidDelegate})` : ''}\n` +
        `    prompt: ${f.prompt.slice(0, 200)}\n` +
        `    correct reasoning: ${f.why}`,
    )
    .join('\n');

  const system =
    'You tune the routing policy text of an AI orchestrator named PI. You will be given the ' +
    'current TypeScript policy file and a list of routing MISTAKES PI made. Rewrite the policy ' +
    'prose so PI makes the correct self-vs-delegate decision on these cases WITHOUT overfitting ' +
    '(do not name the specific test prompts). Rules you MUST obey:\n' +
    '1. Output ONLY the full new file content — no markdown fences, no commentary.\n' +
    '2. Keep EVERY exported name and function signature identical: ' +
    REQUIRED_EXPORTS.join(', ') +
    '. The file must still typecheck.\n' +
    '3. Only change the model-facing PROSE (the preamble text, the WHEN/HOW rubric, the param ' +
    'descriptions). Do not change imports or the structure of renderDelegateDescription.\n' +
    '4. Ground truth for correct routing:\n' +
    GROUND_TRUTH;

  const user = `CURRENT FILE (src/harnesses/pi/routerPolicy.ts):\n\`\`\`ts\n${currentPolicy}\n\`\`\`\n\nROUTING MISTAKES TO FIX:\n${failBlock}\n\nReturn the full revised file content now.`;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: apiModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`fixer ${apiModel} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let content = json.choices?.[0]?.message?.content ?? '';
  // Strip accidental code fences.
  content = content.replace(/^\s*```(?:ts|typescript)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  return content;
}

function candidateValid(content: string): string | null {
  if (content.length < 400) return 'output too short — likely truncated';
  for (const name of REQUIRED_EXPORTS) {
    if (!content.includes(name)) return `missing required export: ${name}`;
  }
  if (!content.includes("from '../../types/index.js'")) return 'dropped the types import';
  return null;
}

function logEval(label: string, e: EvalResult): void {
  console.log(`\n[${label}] accuracy ${e.passed}/${e.total} = ${(e.rate * 100).toFixed(1)}%  (model ${e.model})`);
  for (const g of e.byGroup) console.log(`    ${g.group.padEnd(32)} ${g.pass}/${g.turns}`);
  const fails = e.results.filter((r) => !r.pass);
  if (fails.length) {
    console.log(`    ❌ ${fails.length} fail(s):`);
    for (const f of fails)
      console.log(
        `       ${f.id.padEnd(34)} expected ${f.expect} got ${f.got}${f.invalidDelegate ? ` [${f.invalidDelegate}]` : ''}`,
      );
  }
}

async function main(): Promise<void> {
  const missing = await checkPrereqs();
  if (missing.length) {
    console.error('\n=== SKIP — pi-improve: prerequisites not met ===');
    for (const m of missing) console.error(`  • ${m}`);
    console.error('================================================\n');
    process.exit(2);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const original = fs.readFileSync(POLICY_PATH, 'utf8');
  let best = original;
  let bestRate = -1;
  let bestIter = -1;
  const history: { iter: number; rate: number; kept: boolean; note: string }[] = [];

  // Always restore the BEST version on any exit.
  const restore = () => {
    try {
      fs.writeFileSync(POLICY_PATH, best);
    } catch {
      /* best-effort */
    }
  };
  process.on('SIGINT', () => {
    console.log('\n[pi-improve] interrupted — restoring best policy.');
    restore();
    process.exit(130);
  });

  console.log(`\n=== PI routing-accuracy auto-fix loop ===`);
  console.log(`PI model: ${PI_MODEL}   fixer: ${FIXER_MODEL}`);
  console.log(`gate: ${(GATE * 100).toFixed(0)}%   max-iters: ${MEASURE_ONLY ? 0 : MAX_ITERS}`);
  console.log(`scope: router=${includeRouterCases} scenarios=${includeScenarios}`);

  const measure = (label: string) =>
    runRoutingEval({ model: PI_MODEL, timeoutMs: TIMEOUT_MS, includeRouterCases, includeScenarios }).then((e) => {
      logEval(label, e);
      return e;
    });

  try {
    // ── Baseline ───────────────────────────────────────────────────────────
    let current = await measure('baseline');
    best = original;
    bestRate = current.rate;
    bestIter = 0;
    fs.writeFileSync(path.join(OUT_DIR, 'iter-0-baseline.json'), JSON.stringify(current, null, 2));
    history.push({ iter: 0, rate: current.rate, kept: true, note: 'baseline' });

    if (MEASURE_ONLY) {
      console.log(`\n[pi-improve] --measure-only: no edits. baseline ${(current.rate * 100).toFixed(1)}%`);
    } else if (current.rate >= GATE) {
      console.log(`\n[pi-improve] baseline already ≥ gate — nothing to fix. ✅`);
    } else {
      for (let iter = 1; iter <= MAX_ITERS; iter++) {
        const fails = current.results.filter((r) => !r.pass);
        if (fails.length === 0) break;
        console.log(`\n──────── iter ${iter}/${MAX_ITERS}: revising policy from ${fails.length} failure(s) ────────`);

        let candidate: string;
        try {
          candidate = await callFixer(best, fails); // revise from the BEST so far
        } catch (err) {
          console.log(`[iter ${iter}] fixer error: ${err instanceof Error ? err.message : String(err)} — stopping.`);
          break;
        }
        const invalid = candidateValid(candidate);
        if (invalid) {
          console.log(`[iter ${iter}] rejected candidate: ${invalid}`);
          history.push({ iter, rate: bestRate, kept: false, note: `rejected: ${invalid}` });
          continue;
        }

        // Apply + typecheck.
        fs.writeFileSync(POLICY_PATH, candidate);
        fs.writeFileSync(path.join(OUT_DIR, `iter-${iter}-candidate.ts`), candidate);
        const tc = typechecks();
        if (!tc.ok) {
          console.log(`[iter ${iter}] candidate fails typecheck — reverting.\n${tc.output.split('\n').slice(0, 6).join('\n')}`);
          fs.writeFileSync(POLICY_PATH, best);
          history.push({ iter, rate: bestRate, kept: false, note: 'typecheck failed' });
          continue;
        }

        // Re-measure with the candidate live.
        const trial = await measure(`iter ${iter}`);
        fs.writeFileSync(path.join(OUT_DIR, `iter-${iter}-result.json`), JSON.stringify(trial, null, 2));
        if (trial.rate > bestRate) {
          best = candidate;
          bestRate = trial.rate;
          bestIter = iter;
          current = trial;
          history.push({ iter, rate: trial.rate, kept: true, note: 'improved → kept' });
          console.log(`[iter ${iter}] ✅ improved to ${(trial.rate * 100).toFixed(1)}% — kept.`);
          if (trial.rate >= GATE) {
            console.log(`[iter ${iter}] gate reached. 🎯`);
            break;
          }
        } else {
          fs.writeFileSync(POLICY_PATH, best); // revert
          history.push({ iter, rate: trial.rate, kept: false, note: `no gain (${(trial.rate * 100).toFixed(1)}%) → reverted` });
          console.log(`[iter ${iter}] ↩︎ no gain (${(trial.rate * 100).toFixed(1)}% ≤ ${(bestRate * 100).toFixed(1)}%) — reverted.`);
        }
      }
    }
  } finally {
    restore(); // leave the BEST version on disk
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const changed = best !== original;
  const summary = {
    generatedAt: new Date().toISOString(),
    piModel: PI_MODEL,
    fixerModel: FIXER_MODEL,
    gate: GATE,
    baselineRate: history[0]?.rate ?? null,
    bestRate,
    bestIter,
    policyChanged: changed,
    history,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n==================== pi-improve summary ====================`);
  console.log(`baseline ${((history[0]?.rate ?? 0) * 100).toFixed(1)}%  →  best ${(bestRate * 100).toFixed(1)}% (iter ${bestIter})`);
  console.log(`policy ${changed ? `CHANGED (best from iter ${bestIter}) — review the diff before committing` : 'UNCHANGED'}`);
  console.log(`artifacts: ${OUT_DIR}`);
  console.log(`============================================================`);

  if (bestRate >= GATE) process.exit(0);
  process.exit(1);
}

main().catch((err) => {
  console.error('[pi-improve] FATAL:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
