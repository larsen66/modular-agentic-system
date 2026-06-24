// scripts/eval-scenarios.ts
// REALISTIC multi-turn routing eval for PI-as-main-agent.
//
// Scenarios are grounded in the PRODUCT GOAL and TARGET AUDIENCE, not chat logs:
//   • ICP (STRATEGY §1, ADR 0021): Founder-Builder (solo/SMB owner 1-50, no dev
//     team) primary; Integrators/Agencies second circle. User roles (VISION §2):
//     Builder = can code · Manager = uses AI, can't code.
//   • Canonical persona (STORY §1): "Masha" — runs a 12-person real-estate agency,
//     leads in Google Sheets, tasks in Telegram; adopted AI, it hallucinated a
//     price to her top client, she fired it. Her real need is to OPERATE AI safely.
//   • 6 must-win scenarios (PRODUCT §4): S1 CRM template→first preview · S2 Support
//     Desk daily use · S3 from-chat intent→app · S4 governed change cycle (propose/
//     apply/rollback/audit) · S5 multi-user role-scoped daily use · S6 partner delivery.
//   • Thesis (STORY §3-5, "GovOps"): the value is in GOVERNANCE + OPERATION, not raw
//     generation. So most ICP work is OPERATING a governed business app — data ops,
//     queries, role/access config, governed edits, rollback, audit — which PI does
//     ITSELF. PI delegates ONLY for heavy GENERATION: scaffolding a template/app
//     from intent, importing+rebuilding a repo, large multi-file customization, or
//     running untrusted code in isolation.
//
// Each scenario is a DIALOGUE for ONE persona: turns run against a running
// transcript (prior turns fed back as context), every turn scored self-vs-delegate.
//
// Run:
//   npx tsx --env-file=.env scripts/eval-scenarios.ts
//   npx tsx --env-file=.env scripts/eval-scenarios.ts --gate 0.8 --only operate-crm

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
const GATE = parseFloat(getArg('gate', '0.8'));
const TIMEOUT_MS = parseInt(getArg('timeout', '60000'), 10);
const MODEL = getArg('model', process.env.PI_MODEL ?? 'openrouter/openai/gpt-4o-mini');
const ONLY = getArg('only', ''); // run a single scenario by name

// ─── Scenario model ───────────────────────────────────────────────────────────
type Decision = 'self' | 'delegate';
// Difficulty = how hard the ROUTING DECISION is, not how hard the task is:
//   easy   — unambiguous: a plain answer/op is clearly self; an obvious large
//            scaffold is clearly delegate.
//   medium — needs judgment: vague intent to clarify, an incremental feature, a
//            governed config, a template scaffold.
//   hard   — adversarial/boundary: misleading phrasing ("sounds big but is a
//            restyle" / "sounds casual but is a full build"), multi-intent turns,
//            untrusted code hidden in a friendly ask, "make it faster" = diagnose
//            not rebuild.
type Difficulty = 'easy' | 'medium' | 'hard';
interface Turn {
  user: string;
  expect: Decision;
  difficulty: Difficulty;
  // Soft hint (reported, not gated): if delegating, which harness family fits.
  harnessHint?: string;
  why: string;
}
interface Scenario {
  name: string;
  persona: string; // grounded real-usage context
  turns: Turn[];
}

// Ground-truth rule (the shipped GovOps policy): PI OPERATES the business app
// itself — answers, queries, CRM data ops, role/access config, governed edits,
// rollback, audit, small single-file changes. PI DELEGATES only heavy GENERATION:
// scaffolding a template/app from intent, importing+rebuilding a repo, large
// multi-file customization, or running untrusted code in an isolated sandbox.
const SCENARIOS: Scenario[] = [
  {
    // ICP: Founder-Builder. Persona: Masha. Must-win S3 (from-chat intent→app),
    // S1 (CRM template→first preview), S5 (daily operate).
    name: 'masha-intent-to-crm',
    persona: 'Masha — founder of a 12-person real-estate agency, non-technical. Leads in Google Sheets, tasks in Telegram. Wants one place to run sales.',
    turns: [
      { user: 'У меня агентство недвижимости, 12 человек. Лиды в Google Sheets, задачи в Telegram — бардак. Хочу нормальную CRM, чтобы всё было в одном месте.', expect: 'self', difficulty: 'medium', why: 'Vague intent — PI scopes/clarifies & proposes the right template, does NOT blind-build (must-win S3 starts with intent).' },
      { user: 'Да, поставь CRM-шаблон: контакты, воронка сделок и задачи.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Now a concrete template scaffold → first working preview = heavy generation (must-win S1).' },
      { user: 'Импортируй мои контакты вот из этого CSV в раздел контактов.', expect: 'self', difficulty: 'easy', why: 'In-app data op — PI ingests data with its own tools.' },
      { user: 'Добавь в воронку стадию "Просмотр назначен" между "Контакт" и "Переговоры".', expect: 'self', difficulty: 'medium', why: 'Small config/edit of the existing app.' },
      { user: 'Покажи сделки, которые висят без активности дольше 7 дней.', expect: 'self', difficulty: 'easy', why: 'Query + analysis over app data — PI reads and reports (daily operate, S5).' },
    ],
  },
  {
    // ICP: Founder-Builder. Must-win S4 — governed change + recovery. This is the
    // STORY's core pain: the AI sent a wrong price; she needs audit + rollback + a guard.
    name: 'masha-governed-change-recovery',
    persona: 'Masha again — her AI just sent a wrong price to her top client. She needs to see what happened, undo it, and prevent a repeat.',
    turns: [
      { user: 'Мой агент отправил клиенту неправильную цену в предложении. Покажи, что именно произошло и кто это сделал.', expect: 'self', difficulty: 'medium', why: 'Audit/inspection of the change log — pure read+explain (must-win S4).' },
      { user: 'Откати это изменение.', expect: 'self', difficulty: 'easy', why: 'Governed rollback is a first-class operation PI performs, not a build.' },
      { user: 'Поставь правило: любое предложение с ценой выше 10 млн требует моего подтверждения перед отправкой клиенту.', expect: 'self', difficulty: 'hard', why: 'Sounds like a feature, but it is a governed-workflow / permission rule config — operation, not generation.' },
      { user: 'Покажи аудит: кто и что менял за последнюю неделю.', expect: 'self', difficulty: 'easy', why: 'Audit query — read + summarize.' },
    ],
  },
  {
    // ICP role: Manager (uses AI, can't code). Must-win S5 — multi-user role-scoped
    // daily use. Everything here is operation; nothing is generation.
    name: 'manager-daily-operate',
    persona: 'Oleg — a sales manager (non-coder) using the deployed CRM day to day, role-scoped to his own funnel.',
    turns: [
      { user: 'Покажи мои лиды за сегодня.', expect: 'self', difficulty: 'easy', why: 'Role-scoped query — PI reads and answers.' },
      { user: 'Добавь контакт: Иван Петров, +7-900-000-00-00, компания "Орбита".', expect: 'self', difficulty: 'easy', why: 'Single-record create — in-app data op.' },
      { user: 'Передвинь сделку с "Орбитой" на стадию "Переговоры".', expect: 'self', difficulty: 'easy', why: 'Pipeline data op.' },
      { user: 'Дай менеджеру Сергею доступ только к его лидам в воронке Sales, без остального.', expect: 'self', difficulty: 'medium', why: 'Role/access config — governed settings operation (S5).' },
      { user: 'Отправь этим пяти контактам первое сообщение в Telegram по шаблону.', expect: 'self', difficulty: 'medium', why: 'Connector bulk action via the app — operation, not a build.' },
    ],
  },
  {
    // ICP: Builder (technical founder). VISION "Build from Repo" + isolation policy.
    // This is where heavy generation + untrusted exec legitimately DELEGATE.
    name: 'builder-repo-import-and-exec',
    persona: 'A technical founder who can code, bringing an existing app onto BOS and running migration tooling.',
    turns: [
      { user: 'Вот ссылка на мой GitHub-репозиторий со старым Next.js приложением — склонируй, пересобери под BOS и подними.', expect: 'delegate', difficulty: 'easy', harnessHint: 'opencode', why: 'Repo import + rebuild = large multi-file generation → dedicated coding agent (VISION "Build from Repo").' },
      { user: 'Поменяй основной цвет темы на тёмно-синий и замени логотип в шапке.', expect: 'self', difficulty: 'easy', why: 'Trivial branding edit — PI does it directly.' },
      { user: 'Прогони вот этот скрипт миграции данных от стороннего разработчика в изоляции и покажи вывод.', expect: 'delegate', difficulty: 'medium', harnessHint: 'sandbox', why: 'Untrusted code needs sandbox isolation PI cannot give itself on the control plane.' },
      { user: 'Выгрузи весь код проекта в GitHub.', expect: 'self', difficulty: 'medium', why: 'Export/ownership operation — no code generation (must-win data portability).' },
    ],
  },
  {
    // ICP second circle: Integrator/Agency. Must-win S6 — partner delivery + fleet.
    name: 'integrator-partner-delivery',
    persona: 'An agency delivering CRM/ops to several SMB clients, managing a fleet on BOS.',
    turns: [
      { user: 'Возьми шаблон Support Desk и пересобери его под клиента: брендинг, кастомные поля тикетов и SLA-правила — полноценная сборка.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Heavy multi-file template customization = generation (must-win S6 / S2).' },
      { user: 'Заведи три организации для трёх клиентов с изолированными данными.', expect: 'self', difficulty: 'medium', why: 'Multi-tenant provisioning operation — PI configures, no codegen.' },
      { user: 'Покажи здоровье всех клиентских инстансов: активные runs, ошибки, регрессии.', expect: 'self', difficulty: 'easy', why: 'Fleet-monitoring query — read + report (back-office visibility).' },
      { user: 'У клиента А баг — собери run bundle для диагностики.', expect: 'self', difficulty: 'medium', why: 'Diagnostic operation (support model) — PI assembles it.' },
    ],
  },
  {
    // Onboarding / probing — fastest first interactions, all trivial → self.
    name: 'onboarding-probing',
    persona: 'A brand-new founder poking the product before committing — greetings, account/plan questions.',
    turns: [
      { user: 'привет, что ты умеешь?', expect: 'self', difficulty: 'easy', why: 'Greeting / capability question — just answer.' },
      { user: 'какой у меня тариф и сколько кредитов осталось?', expect: 'self', difficulty: 'easy', why: 'Account/billing query — read + answer.' },
      { user: 'покажи примеры приложений, которые тут можно собрать.', expect: 'self', difficulty: 'easy', why: 'Informational answer — no build, no delegation.' },
    ],
  },

  // ─── SYNTHETIC TIERED SCENARIOS ────────────────────────────────────────────
  {
    // EASY tier: a manager rattling off unambiguous daily ops. Every turn is a
    // clear self — there is nothing to tempt delegation.
    name: 'easy-ops-sprint',
    persona: 'Synthetic — a manager doing a quick burst of obvious CRM operations.',
    turns: [
      { user: 'Покажи все контакты.', expect: 'self', difficulty: 'easy', why: 'Plain list query.' },
      { user: 'Сколько у меня открытых сделок?', expect: 'self', difficulty: 'easy', why: 'Count query — answer inline.' },
      { user: 'Переименуй колонку "Статус" в "Этап".', expect: 'self', difficulty: 'easy', why: 'Trivial label edit.' },
      { user: 'Удали тестовый контакт "asdf".', expect: 'self', difficulty: 'easy', why: 'Single-record delete.' },
      { user: 'Какой сегодня день недели по моему календарю задач?', expect: 'self', difficulty: 'easy', why: 'Trivial answer.' },
    ],
  },
  {
    // MEDIUM tier: must-win S2 (Support Desk daily use). Mixes one template
    // scaffold (delegate) with ordinary config/query ops (self) — each turn needs
    // a small judgment about scaffold-vs-config.
    name: 'medium-support-desk',
    persona: 'Synthetic — a founder standing up a support desk and configuring it (must-win S2).',
    turns: [
      { user: 'Поставь шаблон Support Desk для моей команды поддержки.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Template scaffold → first working preview = generation.' },
      { user: 'Настрой автоответ для новых тикетов: "Спасибо, мы получили ваш запрос".', expect: 'self', difficulty: 'medium', why: 'Automation/config of the existing app — operation.' },
      { user: 'Добавь поле "Приоритет" со значениями low/medium/high в тикеты.', expect: 'self', difficulty: 'medium', why: 'Small schema/field edit on the deployed app.' },
      { user: 'Покажи тикеты со статусом "Открыт" старше 24 часов.', expect: 'self', difficulty: 'easy', why: 'Query — read + report.' },
      { user: 'Сделай дашборд с количеством тикетов по приоритету.', expect: 'self', difficulty: 'medium', why: 'Single small UI addition to the existing app — PI edits, not a full build.' },
    ],
  },
  {
    // HARD tier: adversarial phrasing. The decision is the opposite of what the
    // surface tone/size suggests — this is the tier that separates a real router
    // from keyword-matching.
    name: 'hard-misleading-phrasing',
    persona: 'Synthetic — requests whose wording points the wrong way for routing.',
    turns: [
      { user: 'да просто по-быстрому накидай мне полноценный маркетплейс: каталог, корзина, оплата Stripe, личные кабинеты продавцов и админка.', expect: 'delegate', difficulty: 'hard', harnessHint: 'opencode', why: 'Casual tone ("по-быстрому накидай") hides a large multi-system build → still delegate.' },
      { user: 'полностью переделай дашборд — другие цвета, шрифты и расположение блоков.', expect: 'self', difficulty: 'hard', why: '"Полностью переделай" sounds huge but it is a restyle/layout edit → PI does it.' },
      { user: 'CRM стала тормозить, сделай чтобы работала быстрее.', expect: 'self', difficulty: 'hard', why: '"Make it faster" = diagnose + optimize the existing app, NOT rebuild it.' },
      { user: 'тут код от незнакомого подрядчика, глянь по-быстрому что он делает и просто запусти, проверь что работает.', expect: 'delegate', difficulty: 'hard', harnessHint: 'sandbox', why: 'Friendly "просто запусти" hides untrusted execution → needs sandbox isolation.' },
    ],
  },
  {
    // HARD tier: multi-intent turns bundling a self-op and a generation ask in one
    // message. The heavy-generation part should drive the routing decision.
    name: 'hard-multi-intent',
    persona: 'Synthetic — turns that bundle two intents at once.',
    turns: [
      { user: 'Покажи мои сделки за неделю, и заодно собери мне с нуля отдельное приложение для учёта расходов с категориями и отчётами.', expect: 'delegate', difficulty: 'hard', harnessHint: 'opencode', why: 'Bundles a query (self) with a full from-scratch build — the heavy generation dominates → delegate.' },
      { user: 'Поменяй заголовок на "Главная" и потом выгрузи весь проект в GitHub.', expect: 'self', difficulty: 'hard', why: 'Bundles a trivial edit + an export op — both are operations PI does itself.' },
      { user: 'Ответь, сколько у меня лидов, и импортируй вот этот CSV в контакты.', expect: 'self', difficulty: 'medium', why: 'A query + a data import — both in-app operations.' },
    ],
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
  console.error('\n=== SKIP — scenarios eval: prerequisites not met ===');
  for (const m of MISSING) console.error(`  • ${m}`);
  console.error('===================================================\n');
  process.exit(2);
}

// ─── Setup ────────────────────────────────────────────────────────────────────
await import('../src/harnesses/pi/index.js');
await loadOptionalAdapters();
const catalog: HarnessEnvCatalog = new Kernel().describeTopologies();
const harness = registry.resolveHarness('pi');

const dummyEnv = {
  id: 'eval-dummy',
  capabilities: {
    publicPorts: false, pty: false, snapshot: false, nativeGit: false,
    fileWatch: false, persistentVolume: false, hostsAgentRuntime: true,
  },
  async exec() { return { exitCode: 0, stdout: '', stderr: '' }; },
  async writeFiles() {},
  async readFile() { return null; },
  async exposePort(port: number) { return { url: `http://localhost:${port}` }; },
  async destroy() {},
} as unknown as EnvironmentHandle;

console.log(`\n=== PI Scenarios Eval (real-data-grounded, multi-turn) ===`);
console.log(`model: ${MODEL}   gate: ${GATE}   timeout: ${TIMEOUT_MS}ms`);
console.log(`harnesses=[${catalog.harnesses.map((h) => h.ref).join(', ')}]`);
console.log(`scenarios: ${SCENARIOS.length}\n`);

// ─── Validity of a delegate triple (real resolveTopology) ────────────────────
function delegateValid(req: DelegateRequest): { valid: boolean; resolved?: ExecutionTopology; reason: string } {
  let hc, ec;
  try { hc = registry.resolveHarness(req.harness).capabilities; } catch { return { valid: false, reason: `unknown harness "${req.harness}"` }; }
  try { ec = registry.resolveEnvironment(req.environment).capabilities; } catch { return { valid: false, reason: `unknown env "${req.environment}"` }; }
  const d = resolveTopology(hc, ec, req.topology as ExecutionTopology | undefined);
  return d.ok ? { valid: true, resolved: d.topology, reason: 'runnable' } : { valid: false, reason: d.message };
}

// ─── Run ONE turn against the running transcript ─────────────────────────────
interface TurnResult {
  delegated: boolean;
  delegateReqs: DelegateRequest[];
  toolCalls: string[];
  assistantText: string;
}

async function runTurn(history: { role: string; content: string }[], user: string, runId: string): Promise<TurnResult> {
  const res: TurnResult = { delegated: false, delegateReqs: [], toolCalls: [], assistantText: '' };

  const delegate = async (req: DelegateRequest): Promise<DelegateResult> => {
    res.delegateReqs.push(req);
    res.delegated = true;
    return { cause: 'done', finalText: `[stub] ${req.harness}/${req.environment} completed: ${req.task.slice(0, 80)}` };
  };
  const ctx: RunContext = { delegate, depth: 0, catalog };

  // Feed the conversation so far as context, then the current turn. The harness
  // prepends its own router preamble to this whole block.
  const transcript = history.length
    ? 'Conversation so far:\n' + history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n\n'
    : '';
  const prompt = `${transcript}Current user message: ${user}`;

  let streamed = '';
  let final = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  await harness.run(
    { runId, prompt, model: MODEL, topology: 'agent-as-tool', signal: controller.signal },
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
  clearTimeout(timer);
  res.assistantText = (final || streamed).trim();
  return res;
}

// ─── Score the matrix ─────────────────────────────────────────────────────────
let turnsTotal = 0;
let turnsPass = 0;
const scenarioStats: { name: string; pass: number; turns: number }[] = [];
const byDiff: Record<Difficulty, { pass: number; total: number }> = {
  easy: { pass: 0, total: 0 },
  medium: { pass: 0, total: 0 },
  hard: { pass: 0, total: 0 },
};

for (const sc of SCENARIOS) {
  if (ONLY && sc.name !== ONLY) continue;
  console.log(`\n████ ${sc.name} ████`);
  console.log(`  (${sc.persona})`);

  const history: { role: string; content: string }[] = [];
  let scPass = 0;
  let scTurns = 0;

  for (let i = 0; i < sc.turns.length; i++) {
    const turn = sc.turns[i];
    scTurns++;
    turnsTotal++;
    let r: TurnResult;
    try {
      r = await runTurn(history, turn.user, `scn-${sc.name}-${i}`);
    } catch (err) {
      console.log(`  ${i + 1}. [ERROR] ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const decisionOk = r.delegated === (turn.expect === 'delegate');
    // For a self turn, PI must actually act (answer or use its own tools).
    const didSomething = Boolean(r.assistantText || r.toolCalls.length > 0);
    const pass = decisionOk && (turn.expect === 'delegate' || didSomething);
    byDiff[turn.difficulty].total++;
    if (pass) {
      turnsPass++;
      scPass++;
      byDiff[turn.difficulty].pass++;
    }

    // Build the verdict line.
    const got = r.delegated ? 'DELEGATE' : 'SELF';
    let detail = '';
    if (r.delegated) {
      const v = delegateValid(r.delegateReqs[0]);
      const tgt = `${r.delegateReqs[0].harness}/${r.delegateReqs[0].environment}`;
      detail = v.valid ? ` → ${tgt} (${v.resolved})` : ` → ${tgt} INVALID: ${v.reason}`;
      if (turn.harnessHint) detail += `  [hint: ${turn.harnessHint}]`;
      if (r.delegateReqs.length > 1) detail += `  (${r.delegateReqs.length}× calls ⚠️)`;
    } else {
      detail = r.toolCalls.length ? ` [${[...new Set(r.toolCalls)].join(', ')}]` : ' answered';
    }

    console.log(`  ${i + 1}. [${turn.difficulty}] "${turn.user.slice(0, 84)}${turn.user.length > 84 ? '…' : ''}"`);
    console.log(`     ${pass ? '✅' : '❌'} ${got} (expected ${turn.expect.toUpperCase()})${detail}`);
    if (!pass) console.log(`        why expected: ${turn.why}`);

    // Append to transcript for the next turn.
    history.push({ role: 'user', content: turn.user });
    const asst = r.delegated
      ? `[delegated to ${r.delegateReqs[0]?.harness ?? 'sub-agent'}: done]`
      : r.assistantText || '[handled with tools]';
    history.push({ role: 'assistant', content: asst.slice(0, 240) });
  }

  scenarioStats.push({ name: sc.name, pass: scPass, turns: scTurns });
}

// ─── Summary + gate ──────────────────────────────────────────────────────────
console.log(`\n=== Summary (per scenario: turns routed correctly) ===`);
for (const s of scenarioStats) {
  console.log(`  ${s.name.padEnd(32)} ${s.pass}/${s.turns}`);
}
console.log(`\n=== Accuracy by difficulty ===`);
for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
  const b = byDiff[d];
  const pct = b.total > 0 ? ((b.pass / b.total) * 100).toFixed(0) : '—';
  console.log(`  ${d.padEnd(8)} ${b.pass}/${b.total}${b.total ? ` = ${pct}%` : ''}`);
}
const rate = turnsTotal > 0 ? turnsPass / turnsTotal : 0;
console.log(`\nturn-routing accuracy: ${turnsPass}/${turnsTotal} = ${(rate * 100).toFixed(1)}%   gate: ${(GATE * 100).toFixed(0)}%`);
if (rate >= GATE) {
  console.log(`GATE PASS ✅\n`);
  process.exit(0);
} else {
  console.log(`GATE FAIL ❌ — inspect the ❌ turns above; tune the router preamble / delegate criteria.\n`);
  process.exit(1);
}
