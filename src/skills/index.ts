// src/skills/index.ts
// Skills = read-only instruction text injected into the harness system prompt.
// `vite-react-app` is the old hardcoded SYSTEM string, now a swappable skill;
// `visual-qa` and `web-research` teach the agent how to use the browser and
// web tools. None of these are callable — the side-effecting capability lives
// in the Tool seam (tools/index.ts). A skill just names + frames a tool.

import { registerSkill } from '../registry/index.js';

registerSkill('vite-react-app', () => ({
  ref: 'vite-react-app',
  description: 'Default builder persona: produce a real, runnable web app from the task and expose a live preview.',
  instructions: () => `You are a senior full-stack engineer working inside a fresh sandbox workspace.
Your job: take the user's request and produce a REAL, runnable web app, then start its dev server and expose it so the user sees a live preview.

Rules:
- Build whatever stack best fits the user's request. Keep it minimal but real and working — no placeholders, no "describe only".
- Use the tools to actually create files, install dependencies, and start the dev server. Do not just describe steps — perform them.
- The dev server MUST listen on 0.0.0.0 (not just localhost) and on the port you will expose, and it must accept remote sandbox preview hosts (e.g. for Vite set server.allowedHosts=true).
- When the app is running and the port is exposed, give a one-paragraph summary and stop.
Be concise in your text; let the tools do the work.`,
}));

registerSkill('visual-qa', () => ({
  ref: 'visual-qa',
  description: 'How to verify a generated app actually renders, using the browser tool.',
  instructions: () => `Visual QA:
- After you call expose_port and get a preview URL, call the browser tool with that URL.
- Confirm the returned title and visible text match what the app should render. A blank body or an error string means the build is broken.
- If it is broken: read the background dev-server log (it is appended to bash failures), fix the cause (missing dep, wrong host binding, runtime error), and re-verify with the browser tool before declaring done.
- Do not claim the app works until the browser tool shows real expected content.`,
}));

registerSkill('durable-preview', () => ({
  ref: 'durable-preview',
  description: 'How to capture a durable static snapshot so the preview survives sandbox teardown.',
  instructions: () => `Durable preview (optional final step):
- The live preview from expose_port dies when the sandbox is torn down or idle-killed. To leave a preview that keeps working, capture a static snapshot AFTER the live preview already renders correctly.
- Only do this for a static-buildable web app (e.g. Vite/React). Steps:
  1. Produce a production build with a RELATIVE asset base so assets resolve under a sub-path. For Vite: \`npx vite build --base ./\` (writes to dist/).
  2. Call snapshot_preview with the build dir (default "dist").
- This is best-effort: if the build or snapshot fails, do NOT block — the live preview still stands. Never claim the snapshot exists unless snapshot_preview returned success.`,
}));

registerSkill('web-research', () => ({
  ref: 'web-research',
  description: 'How to gather current information using websearch + webfetch.',
  instructions: () => `Web research:
- Use websearch to find candidate sources for any fact you are not sure of. Prefer primary/official sources.
- Use webfetch to read a promising URL in full before relying on it.
- Cite the URL you used in your summary. Do not invent facts you did not fetch.`,
}));
