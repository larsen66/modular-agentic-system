# План: выбор main-agent harness

Статус: DRAFT · 2026-06-23 · build 01-custom-ts-kernel

## 0. Терминологическая развязка (читать первым)

Не путать две роли — это разные агенты, разные требования:

| Роль | Что это | Harness? | Модель |
|---|---|---|---|
| **Router / IntentClassifier** | один structured-output вызов → Intent (закрытый enum) | **НЕТ** | дешёвый haiku-класс |
| **Main agent (workhorse)** | реально исполняет задачу: правит файлы, билдит, гоняет тесты, поднимает preview | **ДА** — это про него план | сильная модель |

Router выбирает *какой* main-agent harness запустить. Сам router harness'ом не является. Этот план — только про workhorse.

## 1. Кандидаты (что зарегистрировано в registry)

| ref | mode | provider | tool-loop | где живёт агент | креды |
|---|---|---|---|---|---|
| `opencode` | 2 | agnostic (openrouter/anthropic) | **native** read/write/edit/bash внутри песочницы | в песочнице | model key |
| `sdk` | 1 | agnostic (anthropic/openai) | kernel-owned, tools = remote-exec в env | в kernel-процессе | API key |
| `claude-agent-sdk` | 1 | anthropic only | SDK-агент, tools remote-exec | kernel-процесс | ANTHROPIC key |
| `openai-agents` | 1 | openai | SDK-агент | kernel-процесс | OPENAI key |
| `pi` | 2 | agnostic | own loop внутри env | в песочнице | model key |
| `claude-cli` | 2 | anthropic (логин) | CLI own loop | local host | **zero-key** (CLI-логин) |
| `codex-cli` | 2 | openai (логин) | CLI own loop | local host | **zero-key** (CLI-логин) |

## 2. Критерии для main-agent

1. **Агентность** — многоходовой tool-loop, правка файлов, билд/тест без ручного оркестрования.
2. **Provider-agnostic** — не привязываться к одному вендору (инвариант пробуемости матрицы).
3. **Mode-fit под build-задачи** — для постройки приложений нужен тесный низколатентный доступ к файлам/шеллу → mode 2 (агент внутри песочницы) выигрывает у mode 1 (tools как remote-exec).
4. **Zero-key путь** — должен существовать рабочий вариант без API-ключа (CLI-логин).
5. **Совместимость с production-ставкой** — runner-service в основном репо уже завязан на OpenCode; консистентность снижает риск.

## 3. Решение — тиерами (ПЕРЕСМОТРЕНО после research, см. §7)

> Ключевой инсайт research: pi и opencode — **разные топологии, не один слот**. pi — это mode-1 / agent-outside «как надо» (полноценный coding-loop как in-process библиотека), opencode — mode-2 / agent-in-sandbox тяжёлый слот. pi заменяет тонкий `sdk` как kernel-owned workhorse.

### Tier 1 — Primary: **`pi`** (agent-outside, in-process библиотека)
- Назначение: основная масса интерактивных задач — build/run/analyze/explain.
- Почему: настоящий coding-agent loop (read/bash/edit/write) как чистая embeddable-библиотека (`createAgentSession`), provider-agnostic + mid-session switching, **zero server/binary/cold-start** (kernel владеет loop, sync файлов в env). Минимальный context-overhead (нет MCP-налога). Это снимает open-question #1.
- Требует: model key (anthropic/openai/openrouter/любой OpenAI-compatible).
- Риск: solo-maintainer, ~6 мес, автор сам пишет «not primarily designed for embedding». Митигация — registry-шов: своп на opencode/sdk по ref без изменений kernel.

### Tier 2 — Heavy / Fallback: **`opencode`** (agent-in-sandbox)
- Когда: нужны MCP, sub-agents, полная sandbox-автономия, ИЛИ pi нестабилен на задаче.
- Цена: отдельный server-процесс + установка бинаря в песочницу + ~78% латентности (Builder.io head-to-head vs Claude Code). Поэтому НЕ дефолт для интерактива.
- Плюс: зрелый (SST-backed, ~160K★), 75+ провайдеров, совпадает с production-ставкой runner-service.

### Tier 3 — Zero-key: **`claude-cli`** → **`codex-cli`** (на `local`)
- Когда: нет API-ключа, но есть CLI-логин. Ветка `recommendDefaults()` — переиспользовать как есть.
- Реальная генерация без ключа; ограничение — `local` env (без изоляции).

### Не main (override-only)
- `sdk` (тонкий loop) — pi его вытесняет; держать как минимальный provider-agnostic fallback.
- `claude-agent-sdk` / `openai-agents` — vendor-lock, нарушают критерий 2.

## 4. Маппинг Intent → main harness (черновик таблицы роутера)

| Intent | Primary | Fallback | env |
|---|---|---|---|
| `build_web_app` | `opencode` | `sdk` | docker/e2b (publicPorts) |
| `run_or_test_code` | `opencode` | `sdk` | docker/e2b (изоляция) |
| `analyze_or_refactor` | `sdk` | `opencode` | local |
| `explain_or_answer` | `sdk` | `claude-cli` | local |
| `ambiguous` | → `recommendDefaults()` + переспросить | — | — |

Кредо-гейт жёсткий: нет ключа → весь столбец Primary схлопывается в Tier 3 (CLI/local), независимо от intent.

## 5. Открытые вопросы (решить до имплементации)
- [ ] opencode-бинарь: предустановлен в runtime-профиле песочницы или ставится на provision? (влияет на cold-start)
- [ ] Какую модель дефолтить opencode'у — через openrouter или прямой anthropic key? (стоимость/латентность)
- [ ] `pi` vs `opencode` для mode-2 — нужен ли A/B, или сразу фиксируем opencode?
- [ ] Verified-пары: подтвердить `opencode × docker`, `opencode × e2b`, `sdk × docker` в `http.ts`-матрице до прода.

## 6. Verdict (ПЕРЕСМОТРЕНО)
Primary main-agent — **`pi`** (agent-outside, in-process библиотека): настоящий coding-loop, provider-agnostic, zero cold-start, kernel держит максимум контроля/observability. `opencode` — тяжёлый mode-2 fallback (MCP/sub-agents/полная sandbox-автономия), но платит за это server-процессом + cold-start + ~78% латентности, поэтому не дефолт. CLI/local — zero-key. Ставка на молодой pi — **low-regret**: registry-шов свопит на opencode/sdk по ref без изменений kernel; pluggability и есть страховка от bus-factor-1.

## 7. Research findings (2026-06-23)

**pi** ([pi-mono](https://github.com/badlogic/pi-mono), [блог автора](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/), [sdk.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md))
- Embeddable: `createAgentSession()` → `prompt()`/`subscribe()`/`abort()`, tool allowlist, `cwd`, custom tools. In-process (recommended) + RPC headless mode.
- Provider-agnostic: Anthropic/OpenAI/Google/xAI/Groq/Cerebras/OpenRouter/любой OpenAI-compatible; mid-session switching.
- Намеренно без: MCP, sub-agents, plan mode, permission popups, background bash, todos. 4-tool core. MIT.
- Зрелость: solo-maintainer (Mario Zechner), ~6 мес, 7 prod-проектов. Автор: «not primarily designed for embedding» — но SDK это поддерживает.

**opencode** ([opencode.ai/docs/server](https://opencode.ai/docs/server/), [sst/opencode](https://github.com/sst/opencode))
- Зрелый, ~160K★, SST-backed, активные релизы. Headless `opencode serve` + `@opencode-ai/sdk` (OpenAPI), 75+ провайдеров, MCP, sub-agents (build/plan).
- Тяжелее: отдельный server-процесс; Builder.io head-to-head — **на 78% медленнее** Claude Code на одинаковых задачах (Sonnet 4.5). Плюс cold-start бинаря в песочнице.

**Вывод research:** pi и opencode не конкуренты за один слот — pi занимает mode-1 (in-process loop, замена тонкого `sdk`), opencode остаётся mode-2 (тяжёлая sandbox-автономия).

## 8. Реализация — pi как dual-topology main agent (2026-06-23, DONE)

Решение из обсуждения: «only pi for now». Pi сделан главным агентом, координацию топологий ведёт kernel (`resolveTopology`).

**Найденный баг старого pi-харнеса (исправлен):**
1. Объявлял `topologies: ['agent-in-sandbox']` (требует `hostsAgentRuntime`) → не запускался на env без флага.
2. Гонял тулзы на **хостовом** tmpdir и синкал потом → **ломал изоляцию** (bash на твоей машине, не в песочнице).

**Что сделано:**
- `src/harnesses/pi/index.ts` — CAPS: `topologies: ['agent-as-tool','agent-in-sandbox']`, `defaultTopology: 'agent-as-tool'`, `nativeTools: ['read','bash','edit','write']`. `run()` ветвится на `task.topology`.
- `src/harnesses/pi/envTools.ts` — **новый**. `agent-as-tool`: pi-loop на control-plane, его 4 тулзы (read/bash/edit/write) исполняются ВНУТРИ `EnvironmentHandle` через инъекцию pi `Operations` (`createBashToolDefinition({operations})` и т.д., прокидываются как `customTools`). Маппинг хостовых абсолютных путей → env-relative; env резолвит против своего opaque root. Полный сюрфейс Operations: read=`{readFile,access}`, write=`{writeFile,mkdir}`, edit=`{readFile,writeFile,access}`, bash=`{exec→env.exec}`.
  - `agent-in-sandbox`: дефолтные локальные тулзы pi на host scratch + sync в env (gated `hostsAgentRuntime`) — интерим; настоящий pi-in-container/RPC отложен.
- `src/profiles/pi.ts` — **новый**. `PI_MAIN_PROFILE` (harness=pi, defaultTopology=agent-as-tool, env=local) + `piSessionConfig()`.

**Верификация (evidence-first, `scripts/smoke-pi-aat.ts`, OPENROUTER + sonnet-4.5):**
```
tool_call: write {"path":"proof.txt","content":"HELLO_PI_AGENT_AS_TOOL"}
tool_result ok=true: Successfully wrote 22 bytes to proof.txt
env.readFile('proof.txt') => "HELLO_PI_AGENT_AS_TOOL"   ✅ PASS
```
Файл попал в **env** через env-routed тулзы (не в хостовый scratch). `npx tsc --noEmit` — чисто.

**Профиль подключён дефолтом (2026-06-23, DONE):**
- `src/server/http.ts` — `MessageBody.harness`/`environment` теперь optional. Нет `harness` в запросе → run уходит в `PI_MAIN_PROFILE` (harness=pi, env=local, agent-as-tool). model/tool/skill-дефолты применяются ТОЛЬКО на этом неявном пути (явный не-pi harness не получает pi-модель/капы). Topology НЕ форсится (передаётся как есть; kernel берёт harness-default — иначе сломал бы single-topology харнесы через `resolveTopology`). `/registry` теперь отдаёт `profile: PI_MAIN_PROFILE`.
- `src/server/bootstrap.ts` — pi грузится EAGERLY (не в optional-наборе), чтобы падение регистрации было громким на старте, а не `UnknownRefError` на каждом ране.
- **E2E (`scripts/e2e-pi-default.ts`):** config без harness → `resolved harness: pi · topology: agent-as-tool` → `write` ok → `done`. ✅ PASS. Полный `npm test` — 44/44 зелёных.

**OpenRouter канонизирован + кредо-гейт закрыт (2026-06-23, DONE):**
- `src/profiles/pi.ts` — **баг исправлен**: дефолт был `openrouter/anthropic/claude-opus-4-5` (через ДЕФИС) — не резолвится в pi-ai → молчаливый «letting PI choose». Каталог использует ТОЧКУ: `claude-sonnet-4.5/4.6`, `claude-opus-4.5/4.6/4.7`. Новый дефолт — `openrouter/anthropic/claude-sonnet-4.5` (workhorse-баланс; опус — свап через `PI_MODEL`/`body.model`). OpenRouter — канон: один ключ `OPENROUTER_API_KEY` открывает все модели.
- `src/server/http.ts` — дефолтный pi-путь теперь **кредо-гейтован**: нет harness + есть model-ключ (OPENROUTER/ANTHROPIC/OPENAI) → pi; нет harness + нет ключа → `recommendDefaults()` (CLI-логин zero-key, иначе none/none). Раньше pi-дефолт без ключа падал на auth.
- **E2E (`scripts/e2e-pi-default.ts`):** прогнан на `PI_MAIN_PROFILE.model` напрямую (без override) → `pi · agent-as-tool · write ok · done` через OpenRouter sonnet-4.5. ✅ `npm test` 44/44.

**Не сделано (next):**
- `agent-in-sandbox` остаётся интеримом (host scratch + sync); настоящий pi-in-container/RPC — отдельная работа.
- Preview/exposePort в agent-as-tool не разведён (dev-server detached) — отдельно.

## Sources
- https://github.com/badlogic/pi-mono
- https://mariozechner.at/posts/2025-11-30-pi-coding-agent/
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md
- https://opencode.ai/docs/server/
- https://github.com/sst/opencode
- https://www.morphllm.com/ai-coding-agent (Terminal-Bench ranking)
- https://github.com/bradAGI/awesome-cli-coding-agents
