# Harness x Environment Pair Test Summary

Generated: 2026-06-23T11:45Z

Command basis:
- `DEV_NO_AUTH=1 npm run eval:web`
- `DEV_NO_AUTH=1 npm run eval:web -- --cells=codex-cli:local`
- `DEV_NO_AUTH=1 npm run verify:cli -- hermes-cli`

## Results

| Pair | Status | Result |
|---|---|---|
| `sdk x docker` | FAIL | SSE terminated after preview was produced; no terminal/settled frame recorded. Preview: `http://localhost:50882/` |
| `sdk x e2b` | PASS | Preview 200, app marker detected. Preview: `https://5173-ifem7y3c1oijsjeh3lk2p.e2b.app` |
| `sdk x daytona` | PASS | Preview 200, app marker detected. Preview: `https://5173-vi2jvtjln3zkbul4.daytonaproxy01.net` |
| `sdk x codesandbox` | PASS | Preview 200, app marker detected. CodeSandbox preview token redacted. |
| `openai-agents x docker` | PASS | Preview 200, app marker detected. Preview: `http://localhost:51321/` |
| `openai-agents x e2b` | PASS | Preview 200, app marker detected. Preview: `https://5173-if02i3fwz2v6jz5068t5q.e2b.app` |
| `openai-agents x daytona` | PASS | Preview 200, app marker detected. Preview: `https://5173-d9yerbuh5hr6ojco.daytonaproxy01.net` |
| `openai-agents x codesandbox` | PASS | Preview 200, app marker detected. CodeSandbox preview token redacted. |
| `claude-cli x local` | PASS | Preview 200, app marker detected. Preview: `http://localhost:5173/` |
| `opencode x local` | FAIL/HUNG | `opencode serve` started, but the cell did not settle and wedged the eval run; stopped manually. |
| `codex-cli x local` | FAIL | `codex exited 1`: failed to initialize in-process app-server client (`Operation not permitted`). |
| `hermes-cli x local` | FAIL | `hermes exited 1`: `[Errno 1] Operation not permitted: '/Users/dav/.hermes/auth.lock'`. |

## Excluded By Current Matrix

| Pair class | Reason |
|---|---|
| `opencode x non-local` | Mode-2 remote sandbox packaging is not ready; managed sandboxes do not have the `opencode` CLI installed by default. |
| `claude-agent-sdk x *` | Requires Anthropic credential path; not in the OpenRouter-ready matrix. |
| `pi x *` | Current preview prompt blocks on its own `npm run dev` and does not call `env.exposePort`; use `src/harnesses/pi/verify.ts` for PI generation proof. |

## Cleanup

- Stopped 5 local Docker containers labelled `modular-runner`.
- Stopped/removed active Daytona eval sandboxes; final Daytona modular-runner state was `{ "archived": 10 }`.
