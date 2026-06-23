# Manual Web Eval Proof

Generated: 2026-06-22T23:34:48.801Z
Source report: `docs-evidence/manual-web-eval-report.json`
Raw events: `docs-evidence/manual-web-eval-events.jsonl`
Machine proof JSON: `docs-evidence/manual-web-eval-proof.json`

Totals: attempted=10, passed=10, failed=0, skipped=0

## sdk x docker — PASS

- Run ID: `e4c3f9b4-2705-4777-8f63-91ad68309747`
- Session ID: `eval-sdk-docker-1782170760534`
- Terminal: `done`
- History: http://localhost:3010/history/e4c3f9b4-2705-4777-8f63-91ad68309747 (listed=true, detail=true)
- Preview: http://localhost:62549/ (status=200, looksLikeApp=true)
- Raw event row: 1 (42 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (docker node:20-slim) | container created 288c5c6e2df1 | container started | workspace materialized | exec: npm install | exec exit 0 (33.5s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 exposed → http://localhost:62549/
- Final text: I have built a Vite React app named "Matrix Cell Proof" that displays the text "matrix-cell-proof" on the page. The development server is now running and you can view the live preview of the app at [this link](http://loc...

## sdk x e2b — PASS

- Run ID: `4225f6d0-139a-4f0d-a22c-1819ce3cb981`
- Session ID: `eval-sdk-e2b-1782170805907`
- Terminal: `done`
- History: http://localhost:3010/history/4225f6d0-139a-4f0d-a22c-1819ce3cb981 (listed=true, detail=true)
- Preview: https://5173-iz0c0l4e26ihhapq9cd4n.e2b.app (status=200, looksLikeApp=true)
- Raw event row: 2 (42 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (e2b base) | sandbox created iz0c0l4e26ihhapq9cd4n | exec: mkdir -p /home/user/workspace | exec exit 0 (0.4s): mkdir -p /home/user/workspace | workspace materialized | exec: npm install | exec exit 0 (6.4s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173
- Final text: The Vite React app named "Matrix Cell Proof" has been successfully created. The app displays the text "matrix-cell-proof" on the webpage. The development server is running, and you can view the live app at [this link](ht...

## sdk x daytona — PASS

- Run ID: `7daccc4e-a6d3-4b27-b54f-be080a1e7cf7`
- Session ID: `eval-sdk-daytona-1782170832756`
- Terminal: `done`
- History: http://localhost:3010/history/7daccc4e-a6d3-4b27-b54f-be080a1e7cf7 (listed=true, detail=true)
- Preview: https://5173-bicedjohcfkdtaff.daytonaproxy01.net (status=200, looksLikeApp=true)
- Raw event row: 3 (40 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (daytona cloud sandbox) | sandbox created 25ec28ad-9f3a-46bc-ae0c-1946cb91ed07 | workspace materialized | exec: npm install | exec exit 0 (9.3s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 exposed → https://5173-bicedjohcfkdtaff.daytonaproxy01.net
- Final text: I've created a tiny Vite React app named "Matrix Cell Proof" that displays the text "matrix-cell-proof" on the page. The development server is now running, and you can preview the app using [this link](https://5173-biced...

## sdk x codesandbox — PASS

- Run ID: `cbe4745e-522a-4cd4-8407-3f310434d85b`
- Session ID: `eval-sdk-codesandbox-1782170868963`
- Terminal: `done`
- History: http://localhost:3010/history/cbe4745e-522a-4cd4-8407-3f310434d85b (listed=true, detail=true)
- Preview: https://cgdp7j-5173.csb.app?preview_token=[redacted] (status=200, looksLikeApp=true)
- Raw event row: 4 (40 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (codesandbox sandbox) | sandbox created cgdp7j | connected to sandbox agent | workspace materialized | exec: npm install | exec exit 0 (11.0s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 is open
- Final text: The Vite + React app named "Matrix Cell Proof" is now running, displaying the text "matrix-cell-proof" on the page. You can view the live app at the following URL: [Preview your app](https://cgdp7j-5173.csb.app?preview_t...

## openai-agents x docker — PASS

- Run ID: `e2d32068-7d21-4c1e-89b7-f0a544983a98`
- Session ID: `eval-openai-agents-docker-1782170901200`
- Terminal: `done`
- History: http://localhost:3010/history/e2d32068-7d21-4c1e-89b7-f0a544983a98 (listed=true, detail=true)
- Preview: http://localhost:62614/ (status=200, looksLikeApp=true)
- Raw event row: 5 (98 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (docker node:20-slim) | container created 691e5f330cc7 | container started | workspace materialized | exec: npm install | exec exit 0 (28.0s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 exposed → http://localhost:62614/
- Harness proof: openai-agents: SDK path model=openai/gpt-4o-mini mode=gateway base=https://openrouter.ai/api/v1
- Final text: The Vite React app named "Matrix Cell Proof" has been successfully created. It displays the text "matrix-cell-proof" on the page. The development server is running and can be accessed via the following link: [Preview the...

## openai-agents x e2b — PASS

- Run ID: `1ac09aa1-fa16-4d5b-a952-3c89cb43459a`
- Session ID: `eval-openai-agents-e2b-1782170939885`
- Terminal: `done`
- History: http://localhost:3010/history/1ac09aa1-fa16-4d5b-a952-3c89cb43459a (listed=true, detail=true)
- Preview: https://5173-ip2sahvcw3r0urk6q7s9a.e2b.app (status=200, looksLikeApp=true)
- Raw event row: 6 (119 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (e2b base) | sandbox created ip2sahvcw3r0urk6q7s9a | exec: mkdir -p /home/user/workspace | exec exit 0 (0.2s): mkdir -p /home/user/workspace | workspace materialized | exec: npm install | exec exit 0 (6.7s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173
- Harness proof: openai-agents: SDK path model=openai/gpt-4o-mini mode=gateway base=https://openrouter.ai/api/v1
- Final text: The Vite React app named "Matrix Cell Proof" has been successfully created and is now running. It displays the text "matrix-cell-proof" on the page. You can view the live preview of the app at the following link: [Previe...

## openai-agents x daytona — PASS

- Run ID: `f87f63a4-b094-4d8f-be57-681e637bea72`
- Session ID: `eval-openai-agents-daytona-1782170964117`
- Terminal: `done`
- History: http://localhost:3010/history/f87f63a4-b094-4d8f-be57-681e637bea72 (listed=true, detail=true)
- Preview: https://5173-moqrmfopr6o82b2m.daytonaproxy01.net (status=200, looksLikeApp=true)
- Raw event row: 7 (109 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (daytona cloud sandbox) | sandbox created a6a55753-00ca-4f74-a673-2c42986a9949 | workspace materialized | exec: npm install | exec exit 0 (9.9s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 exposed → https://5173-moqrmfopr6o82b2m.daytonaproxy01.net
- Harness proof: openai-agents: SDK path model=openai/gpt-4o-mini mode=gateway base=https://openrouter.ai/api/v1
- Final text: The Vite React app named "Matrix Cell Proof" has been successfully created. It displays the text "matrix-cell-proof" on the page. The development server is running, and you can view the app live at [this link](https://51...

## openai-agents x codesandbox — PASS

- Run ID: `d1bcbb50-9be6-4622-84fe-39bf9845d811`
- Session ID: `eval-openai-agents-codesandbox-1782170990793`
- Terminal: `done`
- History: http://localhost:3010/history/d1bcbb50-9be6-4622-84fe-39bf9845d811 (listed=true, detail=true)
- Preview: https://gzcyff-5173.csb.app?preview_token=[redacted] (status=200, looksLikeApp=true)
- Raw event row: 8 (136 events)
- Tool calls: write_file x5, run_command x2, expose_port x1
- Env proof: provisioning env (codesandbox sandbox) | sandbox created gzcyff | connected to sandbox agent | workspace materialized | exec: npm install | exec exit 0 (11.0s): npm install | dev server starting (background): npm run dev -- --host 0.0.0.0 --port 5173 | port 5173 is open
- Harness proof: openai-agents: SDK path model=openai/gpt-4o-mini mode=gateway base=https://openrouter.ai/api/v1
- Final text: The Vite React app named "Matrix Cell Proof" has been successfully created and is now running. You can view the live app, which displays the exact text "matrix-cell-proof," at the following URL: [Preview the app](https:/...

## claude-cli x local — PASS

- Run ID: `5a17f3f5-da20-42fd-a167-81381057f881`
- Session ID: `eval-claude-cli-local-1782171022405`
- Terminal: `done`
- History: http://localhost:3010/history/5a17f3f5-da20-42fd-a167-81381057f881 (listed=true, detail=true)
- Preview: http://localhost:5173/ (status=200, looksLikeApp=true)
- Raw event row: 9 (37 events)
- Tool calls: Write x5, run_command x2
- Env proof: provisioning env (local /var/folders/hs/t3pr3v_d04j2bchnvc41lql00000gn/T/modular-local-7x2n6T) | workspace materialized | exec: npm install --cache .npm-cache --no-audit --no-fund | exec exit 0 (22.1s): npm install --cache .npm-cache --no-audit --no-fund | dev server starting (background): npm run dev -- --host 127.0.0.1 --port 5173 --strictPort | port 5173 exposed → http://localhost:5173/
- Harness proof: app files generated — installing dependencies
- Final text: Live preview ready at http://localhost:5173/

## opencode x local — PASS

- Run ID: `9eb05ca5-ecc4-4e48-9092-86bba5757658`
- Session ID: `eval-opencode-local-1782171066577`
- Terminal: `done`
- History: http://localhost:3010/history/9eb05ca5-ecc4-4e48-9092-86bba5757658 (listed=true, detail=true)
- Preview: not expected for this pair
- Raw event row: 10 (237 events)
- Tool calls: bash x178
- Env proof: provisioning env (local /var/folders/hs/t3pr3v_d04j2bchnvc41lql00000gn/T/modular-local-sEZ3rI) | workspace materialized | dev server starting (background): mkdir -p .opencode-home .config .local/share .cache .local/state .runtime && export HOME="$PWD/.opencode-home" XDG_CONFIG_HOME="$PWD/.config" XDG_DATA_HOME="$PWD/.local/share" XDG_CACHE_HOME="$PWD/.cache" XDG_STATE_HOME="$PWD/.local/state" XDG_RUNTIME_DIR="$PWD/.runtime" ; opencode db path >/dev/null 2>&1 && opencode serve --pure --port 4537 --hostname 0.0.0.0 | port 4537 exposed → http://localhost:4537/
- Harness proof: [opencode] server reachable at http://localhost:4537/; creating session | [opencode] session ses_10e5395e6ffeH19VEnf0346iQb; prompting (model openrouter/openai/gpt-4o-mini)

## Excluded Not-Ready Pairs

- `codex-cli x local`: current Codex CLI exits before generation with in-process app-server Operation not permitted; not ready in this local managed session.
- `opencode x non-local`: mode-2 live-agent-in-sandbox path is verified only for local; remote sandbox packaging is not ready out of the box.
- `hermes x local`: current Hermes gateway command starts messaging/cron path and never opens the expected HTTP /v1/runs API port.
- `claude-sdk x *`: not part of the current OpenRouter-ready set; requires Anthropic credential path.
- `pi x *`: implemented as control-plane SDK plus file sync, not a ready live-agent-in-sandbox pair.

