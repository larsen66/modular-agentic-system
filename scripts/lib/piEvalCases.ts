// scripts/lib/piEvalCases.ts
// SINGLE SOURCE OF TRUTH for PI routing-accuracy cases. Both the human-facing
// runners (eval-router.ts single-turn, eval-scenarios.ts multi-turn) and the
// closed auto-fix loop (eval-pi-improve.ts) import their cases from here, so the
// loop optimizes against EXACTLY what the runners report.
//
// Ground-truth rule (shipped GovOps policy): PI OPERATES the business app itself
// (answers, queries, data ops, role/access config, governed edits, rollback,
// audit, small single-file changes) and DELEGATES only heavy GENERATION /
// specialized work (scaffold a template/app from intent, import+rebuild a repo,
// large multi-file customization, untrusted-code isolation, browser automation).

export type Decision = 'self' | 'delegate';
export type Difficulty = 'easy' | 'medium' | 'hard';

// ─── Single-turn router cases (was eval-router.ts CASES) ─────────────────────
export interface RouterCase {
  name: string;
  prompt: string;
  expect: Decision; // hard gate: should PI delegate at all?
  isolated?: boolean; // soft: when delegating, should the env be an isolated sandbox?
  difficulty?: Difficulty;
  rationale: string;
}

export const ROUTER_CASES: RouterCase[] = [
  // ── SELF ──────────────────────────────────────────────────────────────────
  { name: 'trivial-fact', prompt: 'What is the capital of France? Answer in one word.', expect: 'self', difficulty: 'easy', rationale: 'A one-word fact — answer directly.' },
  { name: 'trivial-math', prompt: 'What is 17 * 23? Just the number.', expect: 'self', difficulty: 'easy', rationale: 'Pure arithmetic — answer inline.' },
  { name: 'simple-file-write', prompt: 'Create a file notes.txt in the workspace containing the single line: todo: buy milk', expect: 'self', difficulty: 'easy', rationale: 'A one-file write — simple side effect, PI does it itself.' },
  { name: 'simple-code-edit', prompt: 'Write a small JavaScript function reverseString(s) that reverses a string, and save it to utils.js.', expect: 'self', difficulty: 'medium', rationale: 'A tiny single-file script — well within PI; no specialized harness needed.' },
  // ── DELEGATE ────────────────────────────────────────────────────────────────
  { name: 'build-full-app', prompt: 'Build a complete React todo app with Vite and Tailwind: multiple components, add/delete/mark-complete, localStorage persistence, clean styling. Scaffold and implement the whole project.', expect: 'delegate', isolated: true, difficulty: 'medium', rationale: 'Large multi-file app build — a dedicated coding agent fits better than PI inline.' },
  { name: 'stateful-dev', prompt: 'Scaffold a Next.js app, start the dev server, and keep iterating on the landing page with live preview — adjust layout and styles until it looks polished. Keep the server running.', expect: 'delegate', isolated: true, difficulty: 'hard', rationale: 'Long stateful dev with a running server — agent-in-sandbox.' },
  { name: 'untrusted-exec', prompt: 'A user uploaded an untrusted Python script. Run it safely in an isolated sandbox and report its output.', expect: 'delegate', isolated: true, difficulty: 'medium', rationale: 'Untrusted code — needs sandbox isolation PI cannot give on its own.' },
];

// ─── Multi-turn scenarios (was eval-scenarios.ts SCENARIOS) ──────────────────
export interface Turn {
  user: string;
  expect: Decision;
  difficulty: Difficulty;
  harnessHint?: string;
  why: string;
}
export interface Scenario {
  name: string;
  persona: string;
  turns: Turn[];
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'masha-intent-to-crm',
    persona: 'Masha — founder of a 12-person real-estate agency, non-technical. Leads in Google Sheets, tasks in Telegram. Wants one place to run sales.',
    turns: [
      { user: 'У меня агентство недвижимости, 12 человек. Лиды в Google Sheets, задачи в Telegram — бардак. Хочу нормальную CRM, чтобы всё было в одном месте.', expect: 'self', difficulty: 'medium', why: 'Vague intent — PI scopes/clarifies & proposes the right template, does NOT blind-build.' },
      { user: 'Да, поставь CRM-шаблон: контакты, воронка сделок и задачи.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Concrete template scaffold → first working preview = heavy generation.' },
      { user: 'Импортируй мои контакты вот из этого CSV в раздел контактов.', expect: 'self', difficulty: 'easy', why: 'In-app data op — PI ingests data with its own tools.' },
      { user: 'Добавь в воронку стадию "Просмотр назначен" между "Контакт" и "Переговоры".', expect: 'self', difficulty: 'medium', why: 'Small config/edit of the existing app.' },
      { user: 'Покажи сделки, которые висят без активности дольше 7 дней.', expect: 'self', difficulty: 'easy', why: 'Query + analysis over app data — PI reads and reports.' },
    ],
  },
  {
    name: 'masha-governed-change-recovery',
    persona: 'Masha again — her AI just sent a wrong price to her top client. She needs to see what happened, undo it, and prevent a repeat.',
    turns: [
      { user: 'Мой агент отправил клиенту неправильную цену в предложении. Покажи, что именно произошло и кто это сделал.', expect: 'self', difficulty: 'easy', why: 'Audit/inspection of the change log — pure read+explain.' },
      { user: 'Откати это изменение.', expect: 'self', difficulty: 'medium', why: 'Governed rollback is a first-class operation PI performs, not a build.' },
      { user: 'Поставь правило: любое предложение с ценой выше 10 млн требует моего подтверждения перед отправкой клиенту.', expect: 'self', difficulty: 'medium', why: 'Governed-workflow / permission rule config — operation, not generation.' },
      { user: 'Покажи аудит: кто и что менял за последнюю неделю.', expect: 'self', difficulty: 'easy', why: 'Audit query — read + summarize.' },
    ],
  },
  {
    name: 'manager-daily-operate',
    persona: 'Oleg — a sales manager (non-coder) using the deployed CRM day to day, role-scoped to his own funnel.',
    turns: [
      { user: 'Покажи мои лиды за сегодня.', expect: 'self', difficulty: 'easy', why: 'Role-scoped query — PI reads and answers.' },
      { user: 'Добавь контакт: Иван Петров, +7-900-000-00-00, компания "Орбита".', expect: 'self', difficulty: 'easy', why: 'Single-record create — in-app data op.' },
      { user: 'Передвинь сделку с "Орбитой" на стадию "Переговоры".', expect: 'self', difficulty: 'easy', why: 'Pipeline data op.' },
      { user: 'Дай менеджеру Сергею доступ только к его лидам в воронке Sales, без остального.', expect: 'self', difficulty: 'medium', why: 'Role/access config — governed settings operation.' },
      { user: 'Отправь этим пяти контактам первое сообщение в Telegram по шаблону.', expect: 'self', difficulty: 'medium', why: 'Connector bulk action via the app — operation, not a build.' },
    ],
  },
  {
    name: 'builder-repo-import-and-exec',
    persona: 'A technical founder who can code, bringing an existing app onto BOS and running migration tooling.',
    turns: [
      { user: 'Вот ссылка на мой GitHub-репозиторий со старым Next.js приложением — склонируй, пересобери под BOS и подними.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Repo import + rebuild = large multi-file generation → dedicated coding agent.' },
      { user: 'Поменяй основной цвет темы на тёмно-синий и замени логотип в шапке.', expect: 'self', difficulty: 'hard', why: 'Trivial branding edit — PI does it directly (sounds big, is a restyle).' },
      { user: 'Прогони вот этот скрипт миграции данных от стороннего разработчика в изоляции и покажи вывод.', expect: 'delegate', difficulty: 'medium', harnessHint: 'sandbox', why: 'Untrusted code needs sandbox isolation PI cannot give itself on the control plane.' },
      { user: 'Выгрузи весь код проекта в GitHub.', expect: 'self', difficulty: 'hard', why: 'Export/ownership operation — no code generation.' },
    ],
  },
  {
    name: 'integrator-partner-delivery',
    persona: 'An agency delivering CRM/ops to several SMB clients, managing a fleet on BOS.',
    turns: [
      { user: 'Возьми шаблон Support Desk и пересобери его под клиента: брендинг, кастомные поля тикетов и SLA-правила — полноценная сборка.', expect: 'delegate', difficulty: 'medium', harnessHint: 'opencode', why: 'Heavy multi-file template customization = generation.' },
      { user: 'Заведи три организации для трёх клиентов с изолированными данными.', expect: 'self', difficulty: 'medium', why: 'Multi-tenant provisioning operation — PI configures, no codegen.' },
      { user: 'Покажи здоровье всех клиентских инстансов: активные runs, ошибки, регрессии.', expect: 'self', difficulty: 'easy', why: 'Fleet-monitoring query — read + report.' },
      { user: 'У клиента А баг — собери run bundle для диагностики.', expect: 'self', difficulty: 'medium', why: 'Diagnostic operation (support model) — PI assembles it.' },
    ],
  },
  {
    name: 'onboarding-probing',
    persona: 'A brand-new founder poking the product before committing — greetings, account/plan questions.',
    turns: [
      { user: 'привет, что ты умеешь?', expect: 'self', difficulty: 'easy', why: 'Greeting / capability question — just answer.' },
      { user: 'какой у меня тариф и сколько кредитов осталось?', expect: 'self', difficulty: 'easy', why: 'Account/billing query — read + answer.' },
      { user: 'покажи примеры приложений, которые тут можно собрать.', expect: 'self', difficulty: 'easy', why: 'Informational answer — no build, no delegation.' },
    ],
  },
];
