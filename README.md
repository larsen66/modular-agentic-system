# Modular Runner — Option 1: Custom Two-Seam Registry Kernel (TS/Node)

A working **v1** of the **two-seam registry kernel** from
[`docs/architecture/options/01-custom-ts-kernel`](../../docs/architecture/options/01-custom-ts-kernel),
built to [`MVP-DEFINITION.md`](../../docs/architecture/MVP-DEFINITION.md): a real user, on one
machine with their own API key, types a request → a **real agent harness** (real LLM calls, real
tool loop) generates a **real web app** → into a **real Docker container** (files written, deps
installed, dev server started) → and sees a **real live preview** at a real proxied URL.

A thin **policy-only kernel** plus two registries — **Harness** and **Environment** — bridged
*only* by an opaque **`EnvironmentHandle`**. The kernel never sees a `container_id`,
`dockerode`, `workspace_dir`, or any SDK client. Swapping the agent harness or the
execution environment is a **ref-string change**.

**Shipped real path:** `harness: "openai-agents"` (official OpenAI Agents SDK loop) ×
`environment: "docker"` (real container + real reverse-proxy preview).

```
UI (apps/next island) ─POST /message─► Kernel ──resolveHarness(ref)──► Harness adapter
        ▲                               │     ──resolveEnvironment(ref)─► Environment adapter
        └────────── SSE EngineEvent ────┘            │ provision(spec)
                                                      ▼
                                       EnvironmentHandle (opaque): exec · writeFiles ·
                                       readFile · exposePort(p) → { url }
```

The harness drives the agent **entirely through the handle**; Core pumps the normalized
`EngineEvent` stream to the UI over SSE and **always settles exactly once**.

---

## Quick start

Two parts: the **kernel server** (Node/TS, Fastify, SSE) and the **frontend** (`apps/next` —
Vite + React island, deployed to Vercel in prod). Run each in its own terminal.

```bash
# --- 1. Kernel server (port 3000) ---
cd builds/01-custom-ts-kernel
npm install
npm start                       # → http://localhost:3000  (POST /message, GET /stream via SSE)

# --- 2. Frontend (apps/next, port 8081; proxies /__kernel/* → :3000) ---
cd apps/next
npm install
npm run dev                     # → http://localhost:8081
```

Open <http://localhost:8081>, pick **Harness = openai-agents** × **Environment = docker**, type
*"build me a todo app"*, hit **Send**. You'll see streamed assistant text, the per-turn
`EngineEvent` trace, and the **Preview** pane load the live generated app from the environment's
`exposePort()` URL.

> **Requires:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`, plus Docker running.
> The server loads `.harness.env` and `.env` from the repo root, this build directory, and the current
> working directory, then maps friendly keys such as `E2B`, `Daytona`, and `Vercel` onto the adapter env
> names. Keys are never returned by `/architecture`; the frontend only shows redacted configured/missing status.

### OpenAI Agents harness

The `openai-agents` harness is the official OpenAI Agents SDK adaptation. It runs as
`agent-as-tool`: the agent loop stays on the control plane, while generated app files and shell
commands route through the opaque `EnvironmentHandle`.

```bash
OPENROUTER_API_KEY=sk-or-... npm start
# Frontend: pick Harness = openai-agents, Environment = docker
```

When `OPENROUTER_API_KEY` is present, the env loader sets the OpenAI-compatible route used by both
`openai-agents`: `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://openrouter.ai/api/v1`,
and `OPENAI_AGENTS_MODEL=openai/gpt-4o-mini`, unless already
overridden by the shell.

### Local CLI harnesses: Hermes, Claude, Codex

The `local` environment can also run agent CLIs that are already configured on the host:
`hermes-cli`, `claude-cli`, and `codex-cli`. Claude and Codex reuse each CLI's own local
profile/login. Hermes prefers `OPENROUTER_API_KEY` from `.harness.env`/`.env` and otherwise falls
back to its own local profile/config. Each CLI writes the generated app into the per-session
workspace, then the shared runner installs dependencies, starts Vite, and exposes the preview.

```bash
npm run verify:cli -- hermes-cli
```

`hermes-cli` uses Hermes Agent's documented one-shot chat entrypoint,
`hermes chat --yolo -t terminal --quiet -q <prompt>`, adding
`--provider openrouter --model <model>` when `OPENROUTER_API_KEY` is available. Hermes performs
file-writing work in the current directory while the runner owns dependency installation,
dev-server startup, and preview exposure. Override the model with `HERMES_CLI_MODEL` or
`HERMES_INFERENCE_MODEL`; otherwise the existing OpenRouter default is used.

### Managed Daytona environment

The `daytona` environment is for cloud sandbox checks, not the default local dev path. Daytona
sandboxes allocate persistent disk; stopped sandboxes still keep filesystem storage, so abandoned
runs can exhaust the org disk quota. For this runner, Daytona provisions short-lived sandboxes as
ephemeral by default:

```bash
DAYTONA_API_KEY=dtn_... npm start
# Frontend: pick Environment = daytona
```

Defaults used by `src/environments/daytona/`:

| Setting | Default | Why |
|---|---:|---|
| `DAYTONA_EPHEMERAL` | `1` | Deletes the sandbox once it stops (`autoDeleteInterval: 0`) |
| `DAYTONA_USER` | `daytona` | Uses a Linux sandbox user with a valid shell for `process.executeCommand` |
| `DAYTONA_AUTO_STOP_MINUTES` | `15` | Lets inactive runs stop without manual cleanup |
| `DAYTONA_AUTO_ARCHIVE_MINUTES` | `60` | Used only when `DAYTONA_PERSIST_SANDBOX=1` |

If provisioning fails with `Total disk limit exceeded`, archive or delete old stopped sandboxes in the
Daytona dashboard or CLI (`daytona list`, `daytona stop`, `daytona archive`). Use
`DAYTONA_PERSIST_SANDBOX=1` only for a sandbox you deliberately want to recover later.

### The shipped real path

Use `openai-agents × docker` from the frontend, or call `/message` with
`{"harness":"openai-agents","environment":"docker"}`. `npm run docker-smoke`
still proves the Docker environment path independently.

## Verify everything

```bash
npm run verify        # typecheck + grep acceptance gate + full test suite (one command)

# or individually:
npm run typecheck     # tsc --noEmit, strict
npm run grep-gate     # asserts ZERO substrate words in src/kernel, src/registry, src/types
npm test              # vitest: registry, topology, env loading, CLI defaults, Docker (self-skips)
npm run docker-smoke  # standalone real-container proof (needs Docker running)
cd apps/next && npm run build   # builds the frontend island (Vercel output)
```

The **grep acceptance gate** is the headline architectural test: it scans the kernel, registry,
and contracts for `container_id | dockerode | workspace_dir | e2b | @vercel | getHost | hostPort | …`
in *code* (comments are ignored) and fails the build on any hit.

---

## Execution-topology toggle (agent × sandbox-as-tool ↔ agent-in-sandbox)

The relationship between a harness and its environment runs in one of two **topologies**.
This is a first-class, per-run, *validated* parameter — not a hardcoded property of the
harness (it superseded the old numeric `HarnessMode = 1 | 2`).

| Topology | What runs where | Harnesses | Needs |
|---|---|---|---|
| `agent-as-tool` | Agent loop runs on the **control plane**; every tool call routes OUT to the opaque `EnvironmentHandle`. The harness never enters the sandbox. | `claude-agent-sdk`, `openai-agents` | any env (just `exec()`) |
| `agent-in-sandbox` | The agent **process/server runs INSIDE the env** on its own disk; the kernel spawns + drives it via `env.exec`/`exposePort` (or a host workspace dir). | `opencode`, `pi`, `claude-cli`, `codex-cli` | `EnvironmentCapabilities.hostsAgentRuntime` plus that CLI/runtime installed inside the env |

**How the toggle resolves** (`src/kernel/capabilities.ts::resolveTopology`):
a harness declares the **set** of topologies it can run in (`capabilities.topologies`) plus a
`defaultTopology`; an env declares whether it can host an agent runtime (`hostsAgentRuntime`).
Per run, the kernel picks exactly one:

- request a topology via `POST /message { topology: "agent-in-sandbox" | "agent-as-tool" }`;
- supported by both harness AND env → used;
- impossible (e.g. `agent-in-sandbox` on a non-hosting env, or a topology the harness lacks) →
  the run settles as a **clean terminal** `unsupported_topology` (same discipline as
  `unknown_capability_ref`), never a misleading provision failure;
- omitted → the harness `defaultTopology` if the env can host it, else the first hostable one.

`GET /registry` returns `topologyMatrix` (per-harness `topologies` + per-env `hostsAgentRuntime`,
derived live from adapter capabilities — never hand-maintained) so the frontend can offer the toggle
only for valid `(harness, env, topology)` triples. Topology support is necessary but not sufficient
for CLI-based harnesses: `opencode` also requires the `opencode` binary inside that environment.
The verified pair is `opencode x local`; managed sandboxes should use `openai-agents` unless
their image explicitly installs the matching CLI. A future *dual-topology* harness (one that declares
both) drops into this seam with zero kernel changes — that's the extension point the toggle is built for.

---

## What's built vs the MVP definition

The MVP test: *"Given a valid model API key and Docker, the system takes a chat message and returns a
working, previewable web app generated by a real agent in a real sandbox — and the same flow works
after swapping `harness` / `environment` ref strings."*

| Capability | Status | Evidence |
|---|---|---|
| OpenAI Agents SDK adapter | ✅ real | `src/harnesses/openai-agents/` — direct `@openai/agents` `Agent`, `run`, and strict-schema tools; verified with Docker from the frontend |
| Local env resolution | ✅ real | `src/server/harnessEnv.ts`; `.env` / `.harness.env` search path, friendly key aliases, OpenRouter model route, and redacted `/architecture` diagnostics |
| Real environment — Docker container, real exec, real file sync | ✅ real | `src/environments/docker/`; `test/docker.test.ts` (4 tests); `npm run docker-smoke` |
| Real app generated INTO the container (files + `npm install` + dev server) | ✅ real | OpenAI Agents and CLI harnesses route file/shell work through `EnvironmentHandle` |
| Real live preview via real proxied URL → HTTP 200 | ✅ real | Docker `exposePort` emits `preview_ready http://localhost:<port>/` |
| Swap harness / environment by ref string | ✅ real | Harness/env adapters register by ref string through the registries |
| Kernel policy + settlement-once + SSE stream | ✅ real | `src/kernel/`; registry/topology tests; `npm start` + curl |
| Frontend island — chat + live preview iframe | ✅ real | `apps/next/`; `cd apps/next && npm run build`; screenshots in `docs-evidence/` |
| Grep acceptance gate (no substrate leak) | ✅ green | `npm run grep-gate` → `clean ✅` |

### Intentionally out of scope (startup ≠ enterprise, per MVP-DEFINITION)

- Multi-tenancy, accounts, auth, RBAC; autoscaling/HA; billing hardening (billing is a `usage_delta`
  sum in `src/kernel/settlement.ts`); full observability/compliance; secrets-manager infra (plain env
  vars are fine for v1).
- **Snapshot / PTY / file-watch / persistent volumes** — capability flags `false`, degraded by the
  kernel's fallback ladder (`src/kernel/capabilities.ts`).
- **Docker preview proxy** = simplest correct thing: local reverse proxy → `http://localhost:<proxyPort>/`
  + raw WS passthrough for HMR. No HTML/URL rewriting (v2).
- **Additional real adapters** (OpenCode mode-2; managed E2B/Daytona/CodeSandbox envs) are
  intentionally adapter-scoped. `opencode` is installed here but also needs a model key; managed
  cloud environments need their provider accounts and API keys.

---

## Layout

```
src/
  types/        # FROZEN CONTRACTS — events.ts, environment.ts, harness.ts (import nothing internal)
  registry/     # register/resolve/list for both seams (module-scoped Map, not a globalThis singleton)
  kernel/       # POLICY ONLY (grep-clean): admission, session, orchestrator, settlement, preview, capabilities
  harnesses/
    openai-agents/   # official OpenAI Agents SDK adapter
    claude-agent-sdk/# official Claude Agent SDK adapter
    cli/             # local CLI harnesses
    opencode/, pi/   # specialized coding/router harnesses
  environments/
    docker/     # ★ REAL env: dockerode + exec/tar file IO + proxy.ts written-once reverse proxy
    e2b/, daytona/, codesandbox/, local/
  server/       # Fastify http.ts (POST /message SSE), sse.ts, bootstrap.ts (loads adapters)
  index.ts      # entrypoint
scripts/
  docker-smoke.ts, port-check.ts, grep-gate.mjs
test/           # registry, topology, env loading, docker (self-skipping)
apps/next/      # frontend island (Vite + React) — chat + live preview; deployed to Vercel
docs-evidence/  # screenshots, eval reports, and manual verification artifacts
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ ok, harnesses[], environments[] }` |
| `GET` | `/registry` | the two registry listings (frontend dropdowns) |
| `POST` | `/message` | start a run; streams the `EngineEvent` SSE sequence + `settled` frame |
| `GET` | `/history` | list persisted runs visible to the caller |
| `GET` | `/history/:runId` | one persisted run plus its ordered event stream |
| `GET` | `/memory/:sessionId` | compact owner-scoped memory fed into later turns in that session |
| `GET` | `/preview/:sessionId` | current preview URL for a session, if any |

## Session persistence and memory

The runner keeps two separate records:

- **Run history**: full replay/debug storage. With Supabase configured, runs and
  ordered events go to `runs` / `run_events` behind RLS. Without Supabase, the
  fallback appends full runs to `.history/runs.jsonl`.
- **Session memory**: compact context for the next turn. The server stores a
  small owner-scoped JSON record in `.history/session-memory.json`, remembers the
  latest turns for a `sessionId`, and prepends that context to the next
  `/message` using the same session. The original user prompt is still what
  history records.

This is intentionally the simple v1: no vector database, no extra model call,
and no new dependency. Raw events remain the audit/debug source; memory is only
the short working context worth sending back to the agent.
