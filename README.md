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

**Shipped real path:** `harness: "sdk"` (real mode-1 agent loop, Anthropic/OpenAI) ×
`environment: "docker"` (real container + real reverse-proxy preview). The `dummy`/`dummy-echo`
harnesses and `dummy` env exist **only as a zero-infra test rung** (CI fixtures) — not the product.

```
UI (Carbon Studio) ──POST /message──► Kernel ──resolveHarness(ref)──► Harness adapter
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

Two parts: the **kernel server** (Node/TS, Fastify, SSE) and the **Studio** (Vite + React +
IBM Carbon, light theme). Run each in its own terminal.

```bash
# --- 1. Kernel server (port 3000) ---
cd builds/01-custom-ts-kernel
npm install
npm start                       # → http://localhost:3000  (POST /message, GET /stream via SSE)

# --- 2. Studio UI (port 5173, proxies /message + /registry to :3000) ---
cd studio
npm install
npm run dev                     # → http://localhost:5173
```

Open <http://localhost:5173>, pick **Harness = sdk** × **Environment = docker**, type
*"build me a todo app"*, hit **Send**. You'll see streamed assistant text, the per-turn
`EngineEvent` trace, and the **Preview** pane load the live generated app from the environment's
`exposePort()` URL.

> **Requires:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`, plus Docker running.
> The server loads `.harness.env` and `.env` from the repo root, this build directory, and the current
> working directory, then maps friendly keys such as `E2B`, `Daytona`, and `Vercel` onto the adapter env
> names. Keys are never returned by `/architecture`; Studio only shows redacted configured/missing status.

### OpenAI Agents harness

The `openai-agents` harness is the official OpenAI Agents SDK adaptation. It runs as
`agent-as-tool`: the agent loop stays on the control plane, while generated app files and shell
commands route through the opaque `EnvironmentHandle`.

```bash
OPENROUTER_API_KEY=sk-or-... npm start
# Studio: pick Harness = openai-agents, Environment = docker
```

When `OPENROUTER_API_KEY` is present, the env loader sets the OpenAI-compatible route used by both
`sdk` and `openai-agents`: `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://openrouter.ai/api/v1`,
`SDK_MODEL=openai/gpt-4o-mini`, and `OPENAI_AGENTS_MODEL=openai/gpt-4o-mini`, unless already
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
# Studio: pick Environment = daytona
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

### The shipped real path — one command (real harness × real Docker × real preview)

```bash
cd builds/01-custom-ts-kernel
npm install

# With a real key → real LLM builds the app:
ANTHROPIC_API_KEY=sk-ant-... npm run real-e2e
#   (or)  OPENAI_API_KEY=sk-... npm run real-e2e

# Without a key → identical path, with a bundled Anthropic-WIRE mock standing in for ONLY the
# LLM brain (real Docker, real npm install, real Vite, real proxied preview — everything else real):
npm run real-e2e
```

`real-e2e` runs `harness=sdk × environment=docker`, prints the live `EngineEvent` stream, and asserts
the preview URL serves HTTP 200. Verified output (mock LLM, real everything else):

```
  → tool_call: write_file(package.json) … vite.config.js … index.html … src/main.jsx … src/App.jsx
  → tool_call: run_command(npm install)        ← added 62 packages in 3m
  → tool_call: run_command(npm run dev … :5173) background
  ★ preview_ready: http://localhost:54651/
  ■ terminal: done
  real Docker container + exec/files:  YES ✓
  preview URL serves HTTP 200:         YES ✓
  PASS ✅
```

### `verify:real` — prove every line except model tokens is real (no key needed)

```bash
npm run verify:real
```

Drives the **REAL** SDK harness code path (provider client, agent loop, tool routing) against a local
**OpenAI-compatible mock** (`OPENAI_BASE_URL`), hitting the **REAL Docker** backend (real container,
real `npm install`, real Vite) with a **REAL reverse-proxied preview**. Exits non-zero unless the
preview serves HTTP 200 with the generated app. Verified verdict:

```
provider/model:                 openai/gpt-4o (real=false)
real harness ran tools in Docker: YES ✓
preview_ready emitted:            YES ✓ http://localhost:<port>/
preview served HTTP 200:          YES ✓
settlement fired (cause=done):    YES ✓
PASS ✅  (real harness × real Docker × real preview; only model tokens are mocked)
```

**Make it fully live:** the *same* harness calls a real model with zero code change —
`OPENAI_API_KEY=sk-… npm run verify:real` (or `ANTHROPIC_API_KEY=sk-ant-… npm run real-e2e`).

### Honest readiness probe — is the model real right now?

```bash
curl -s localhost:3000/healthz | jq .sdk
# real key set:   { "real": true,  "provider": "anthropic", "model": "claude-sonnet-4-6", "mode": "real-key" }
# mock base URL:  { "real": false, "provider": "openai",    "model": "gpt-4o",            "mode": "mock-base-url" }
# nothing set:    { "real": false, "provider": null, "model": null, "mode": "unconfigured" }
```

`/healthz` reports whether the shipped `sdk` harness would hit a **real** model — never exposes the key.

### Test rung (zero infra, no key, no network — CI fixture, NOT the product)

```bash
npm run demo                    # in-process Dummy×Dummy + the harness swap, prints EngineEvents
```

---

## Verify everything

```bash
npm run verify        # typecheck + grep acceptance gate + full test suite (one command)

# or individually:
npm run typecheck     # tsc --noEmit, strict
npm run grep-gate     # asserts ZERO substrate words in src/kernel, src/registry, src/types
npm test              # vitest: registry + provider-select + Dummy×Dummy + real Docker (self-skips)
npm run docker-smoke  # standalone real-container proof (needs Docker running)
npm run real-e2e      # THE real path end-to-end (real harness × real Docker × real preview)
cd studio && npm run build   # builds the Carbon light-theme UI
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
| `agent-as-tool` | Agent loop runs on the **control plane**; every tool call routes OUT to the opaque `EnvironmentHandle`. The harness never enters the sandbox. | `sdk`, `claude-agent-sdk`, `openai-agents` | any env (just `exec()`) |
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
derived live from adapter capabilities — never hand-maintained) so the Studio can offer the toggle
only for valid `(harness, env, topology)` triples. Topology support is necessary but not sufficient
for CLI-based harnesses: `opencode` also requires the `opencode` binary inside that environment.
The verified pair is `opencode x local`; managed sandboxes should use `openai-agents`/`sdk` unless
their image explicitly installs the matching CLI. A future *dual-topology* harness (one that declares
both) drops into this seam with zero kernel changes — that's the extension point the toggle is built for.

---

## What's built vs the MVP definition

The MVP test: *"Given a valid model API key and Docker, the system takes a chat message and returns a
working, previewable web app generated by a real agent in a real sandbox — and the same flow works
after swapping `harness` / `environment` ref strings."*

| Capability | Status | Evidence |
|---|---|---|
| Real agent harness — LLM calls + tool loop (mode 1) | ✅ real | `src/harnesses/sdk/` — Anthropic + OpenAI clients over real HTTP; `npm run real-e2e` drives 5 `write_file` + `npm install` + dev-server + `expose_port` tool calls |
| Provider auto-detect (`ANTHROPIC_API_KEY` → Claude, else `OPENAI_API_KEY` → GPT) | ✅ real | `src/harnesses/sdk/providers/`; `test/provider-select.test.ts` (4 tests) |
| OpenAI Agents SDK adapter | ✅ real | `src/harnesses/openai-agents/` — direct `@openai/agents` `Agent`, `run`, and strict-schema tools; verified with Docker from Studio |
| Local env resolution | ✅ real | `src/server/harnessEnv.ts`; `.env` / `.harness.env` search path, friendly key aliases, OpenRouter model route, and redacted `/architecture` diagnostics |
| Real environment — Docker container, real exec, real file sync | ✅ real | `src/environments/docker/`; `test/docker.test.ts` (4 tests); `npm run docker-smoke` |
| Real app generated INTO the container (files + `npm install` + dev server) | ✅ real | `real-e2e` log: "added 62 packages in 3m", Vite started via hardened `nohup` background launch |
| Real live preview via real proxied URL → HTTP 200 | ✅ real | `real-e2e` verdict: `preview_ready http://localhost:<port>/` + `serves HTTP 200 ✓`; `docs-evidence/real-e2e-run.log` |
| Swap harness / environment by ref string | ✅ real | `sdk`↔`dummy` and `docker`↔`dummy` are pure ref-string changes; `dummy-echo` proves a 2nd harness variant |
| Kernel policy + settlement-once + SSE stream | ✅ real | `src/kernel/`; `test/dummy-x-dummy.test.ts`; `npm start` + curl |
| Carbon (light) Studio — chat + live preview iframe | ✅ real | `studio/`; `cd studio && npm run build`; screenshots in `docs-evidence/` |
| Grep acceptance gate (no substrate leak) | ✅ green | `npm run grep-gate` → `clean ✅` |

### The one piece I could not self-execute (flagged, not faked)

**A real LLM API call.** This sandbox has **no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`**, so I could not
bill a real model myself. The real path is fully implemented — `src/harnesses/sdk/providers/anthropic.ts`
and `openai.ts` make real `fetch` calls to the real Messages / Chat Completions endpoints, and the
harness reads the key from `process.env`. To prove every *other* part of the loop is real without a
key, the SDK harness's HTTP wire is exercised by a bundled **Anthropic-wire mock**
(`scripts/mock-llm.ts`) that speaks the exact `/v1/messages` format and scripts a realistic tool loop.
**Swapping it for the real model is zero code change:** set `ANTHROPIC_API_KEY` (and unset
`ANTHROPIC_BASE_URL`) and the same harness calls Claude. Everything downstream of the model —
container, exec, file sync, `npm install`, Vite, the proxied preview — is **100% real and self-verified**
(`npm run real-e2e` → PASS).

### Intentionally out of scope (startup ≠ enterprise, per MVP-DEFINITION)

- Multi-tenancy, accounts, auth, RBAC; autoscaling/HA; billing hardening (billing is a `usage_delta`
  sum in `src/kernel/settlement.ts`); full observability/compliance; secrets-manager infra (plain env
  vars are fine for v1).
- **Snapshot / PTY / file-watch / persistent volumes** — capability flags `false`, degraded by the
  kernel's fallback ladder (`src/kernel/capabilities.ts`).
- **Docker preview proxy** = simplest correct thing: local reverse proxy → `http://localhost:<proxyPort>/`
  + raw WS passthrough for HMR. No HTML/URL rewriting (v2).
- **Additional real adapters** (OpenCode mode-2; managed E2B/Vercel env) are `+1` files each; the seam
  is proven by the `sdk`/`dummy` harness swap and the `docker`/`dummy` env swap. `opencode` is installed
  here but also needs a model key; E2B/Vercel need accounts.

---

## Layout

```
src/
  types/        # FROZEN CONTRACTS — events.ts, environment.ts, harness.ts (import nothing internal)
  registry/     # register/resolve/list for both seams (module-scoped Map, not a globalThis singleton)
  kernel/       # POLICY ONLY (grep-clean): admission, session, orchestrator, settlement, preview, capabilities
  harnesses/
    sdk/        # ★ REAL harness (mode 1): agent loop + tools→handle; providers/ = Anthropic + OpenAI clients
    dummy/, dummy2/   # zero-infra test rung only (CI fixtures), NOT the product
  environments/
    docker/     # ★ REAL env: dockerode + exec/tar file IO + proxy.ts written-once reverse proxy
    dummy/      # in-memory test rung only
  server/       # Fastify http.ts (POST /message SSE), sse.ts, bootstrap.ts (loads adapters)
  index.ts      # entrypoint
scripts/
  real-e2e.ts          # ★ real harness × real Docker × real preview (auto-uses mock if no key)
  real-e2e-keepalive.ts# same, holds the preview open for external curl/browser verification
  mock-llm.ts          # Anthropic-WIRE mock — stands in for ONLY the LLM brain when no key
  docker-smoke.ts, port-check.ts, demo.ts, grep-gate.mjs
test/           # registry, provider-select, dummy-x-dummy, docker (self-skipping) — 16 tests
studio/         # Vite + React + @carbon/react (light "white" theme), two-pane chat+preview
docs-evidence/  # real-e2e-run.log, live-preview-generated-app.png, studio-sdk-docker-live-preview.png, …
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ ok, harnesses[], environments[] }` |
| `GET` | `/registry` | the two registry listings (Studio dropdowns) |
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
