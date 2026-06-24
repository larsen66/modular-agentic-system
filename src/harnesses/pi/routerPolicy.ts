// src/harnesses/pi/routerPolicy.ts
// ─── THE single tunable surface for PI's routing JUDGMENT ─────────────────────
// All model-facing text that teaches PI WHEN to do a task itself vs. delegate it
// — and HOW to pick harness / environment / topology — lives HERE, in ONE file.
// index.ts (the run preamble) and delegateTool.ts (the `delegate` tool
// description + parameter docs) import from here and add NO policy prose of their
// own. The accuracy auto-fix loop (scripts/eval-pi-improve.ts) edits ONLY this
// file: it rewrites the marked policy blocks, re-runs the routing eval, and keeps
// the change if accuracy improved. Keep the exported names + signatures stable so
// the loop's typecheck gate always holds; the *wording* is the knob.
//
// Ground-truth routing rule (the shipped GovOps policy):
//   PI is a GENERALIST that OPERATES the business app itself — answers, queries,
//   data ops, role/access config, governed edits, rollback, audit, small
//   single-file changes. PI DELEGATES only heavy GENERATION / specialized work:
//   scaffolding a template/app from intent, importing+rebuilding a repo, large
//   multi-file customization, running untrusted code in isolation, or a
//   capability a sub-agent is purpose-built for (e.g. browser automation).

import type { HarnessEnvCatalog } from '../../types/index.js';

// ─── Block A: the run preamble ───────────────────────────────────────────────
// Prepended to the user prompt when PI is the router (a delegate seam exists).
// The do-it-myself-vs-delegate line is a PROMPT CRITERION, not a structural gate
// — PI keeps its full coding surface and chooses to escalate only when warranted.
export function buildRouterPreamble(userPrompt: string): string {
  return (
    `You are the MAIN agent. You have your own tools (read, write, edit, bash in the ` +
    `workspace) AND the ability to delegate to specialized sub-agents.\n\n` +
    `DEFAULT: DO THE TASK YOURSELF. Handle all simple and normal work directly — ` +
    `answers, explanations, file edits, small scripts, single-file changes, quick ` +
    `commands, ordinary debugging.\n\n` +
    `DELEGATE ONLY when a specialized harness clearly fits the task BETTER than you:\n` +
    `  • a large or complex multi-file app build, or a long autonomous coding session ` +
    `→ a dedicated coding agent;\n` +
    `  • untrusted or risky code that needs sandbox isolation;\n` +
    `  • browser automation / web interaction, or any capability a sub-agent is ` +
    `purpose-built for (see the \`delegate\` tool's harness list).\n` +
    `If you can reasonably do it yourself, DO NOT delegate. When you do delegate, make ` +
    `ONE call and prefer to OMIT topology (the harness default is correct).\n\n` +
    `User request:\n${userPrompt}`
  );
}

// ─── Block B: per-harness purpose hints ──────────────────────────────────────
// One line per harness ref describing what it is GOOD FOR — guidance for the
// model's choice. Topologies come from the LIVE catalog (can't drift); these
// only describe fit. Unknown refs fall back to a generic line in the renderer.
export const HARNESS_PURPOSE: Record<string, string> = {
  opencode:
    'full coding agent that lives INSIDE the sandbox — best for scaffolding/building apps and long interactive dev sessions with a running server',
  'claude-agent-sdk':
    'Claude-based agent (strong reasoning + tools) — research, multi-step analysis, careful edits',
  'openai-agents': 'OpenAI Agents loop — general agentic tasks with tools',
  'codex-cli': 'Codex CLI coding agent — code generation/build via local login',
  'claude-cli': 'Claude CLI coding agent — code work via local login',
  'hermes-cli': 'Hermes CLI agent — code work via local login',
  pi: 'the orchestrator itself — do NOT delegate here (you ARE pi)',
};

// ─── Block C: the `delegate` tool description (WHEN + HOW rubric) ─────────────
// Renders the live catalog + selection CRITERIA into the tool description, so the
// model chooses by clear rules. Catalog data is live (never drifts); the rubric
// teaches HOW to pick harness / environment / topology.
export function renderDelegateDescription(catalog: HarnessEnvCatalog): string {
  const harnesses = catalog.harnesses
    .map(
      (h) =>
        `  - "${h.ref}" — ${HARNESS_PURPOSE[h.ref] ?? 'specialized sub-agent'}\n` +
        `      runs as: [${h.topologies.join(', ')}] (default: ${h.defaultTopology})`,
    )
    .join('\n');
  const environments = catalog.environments
    .map(
      (e) =>
        `  - "${e.ref}" — ${e.ref === 'local' ? 'host scratch (NOT isolated — avoid for untrusted code)' : 'isolated sandbox'}` +
        `${e.hostsAgentRuntime ? ' · can host an in-sandbox agent' : ''}`,
    )
    .join('\n');

  return [
    'Run a self-contained sub-task on a specialized sub-agent and wait for its result.',
    '',
    'WHEN to delegate — you have your OWN tools (read/write/edit/bash); do simple work',
    'yourself. Delegate ONLY when a specialized harness fits the task clearly BETTER:',
    '  • a large/complex multi-file app build or a long autonomous coding session;',
    '  • untrusted or risky code that needs sandbox isolation;',
    '  • browser automation / web interaction, or another harness-specific capability.',
    '  If you can reasonably do it yourself (an answer, a small edit, a quick script), DO NOT',
    '  delegate.',
    '',
    'HOW to pick the HARNESS — match the task to a purpose below:',
    harnesses || '  (none)',
    '',
    'HOW to pick the ENVIRONMENT:',
    '  • Code execution / untrusted code → an ISOLATED sandbox (never "local").',
    '  • The harness may force a topology that needs an agent-hosting env (see below).',
    environments || '  (none)',
    '',
    'HOW to pick the TOPOLOGY (where the sub-agent runs) — see the `topology` field.',
    '  PREFER TO OMIT IT: each harness has a correct default and the system validates it.',
    '  Only set "agent-in-sandbox" for a persistent dev session (running server + live',
    '  preview, long iterative dev). Never set a topology a harness does not list above.',
    '',
    'RULES:',
    '  • Make ONE delegate call per sub-task. Do not repeat the same call.',
    '  • Give `task` as a complete, standalone instruction the sub-agent can act on alone.',
  ].join('\n');
}

// ─── Block D: `delegate` parameter descriptions ──────────────────────────────
export const HARNESS_PARAM_DESC =
  'Harness ref to run the sub-task. Pick the one whose purpose fits (see description).';
export const ENVIRONMENT_PARAM_DESC =
  'Environment ref the sub-run executes in. Use an isolated sandbox for code execution.';
export const TASK_PARAM_DESC = 'Self-contained instruction for the sub-agent.';
export const MODEL_PARAM_DESC = 'Optional model override for the sub-run.';
export const TOPOLOGY_FIELD_DESCRIPTION =
  'WHERE the sub-agent runs. PREFER TO OMIT THIS — the chosen harness has a correct ' +
  'default and the system resolves a runnable topology for you. Only set it when you ' +
  'have a specific reason:\n' +
  "  • 'agent-in-sandbox' — the task needs a PERSISTENT runtime inside the env: " +
  'running a dev server and iterating with live preview, a long stateful dev session.\n' +
  "  • 'agent-as-tool' — a single bounded action (run one script, one build), max " +
  'isolation.\n' +
  'NEVER set a value the chosen harness does not list as supported — that fails the run.';
