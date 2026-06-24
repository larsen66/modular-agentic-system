// src/tools/index.ts
// The canonical Tool set, registered ONCE into the tool seam. This is OpenCode's
// out-of-the-box surface (read/write/edit/bash + webfetch/websearch) ported into
// portable ToolSpecs, PLUS expose_port (the kernel's preview capability, which
// OpenCode lacks) and browser (playwright-style page inspection for visual QA).
//
// Each execute body routes OUT to the opaque EnvironmentHandle exactly as the
// old per-harness copies did — the matured logic (file normalization, background
// dev-server log capture, per-env serialization) is preserved here, in one place.
// Control-plane tools (webfetch/websearch) ignore env and run on the control
// plane, proving the seam carries non-env tools too.

import { registerTool } from '../registry/index.js';
import type { EnvironmentHandle, RunIO, ToolResult } from '../types/index.js';
import { isProcessHandle } from '../types/index.js';

// ── shared helpers (ported from openai-agents/execEngine.ts) ─────────────────

// Per-env serialization: concurrent tool calls against one handle run in order,
// so a write never races a read on the same workspace. The agent loops are
// sequential, but any concurrent-dispatch harness reusing these specs is safe.
const toolQueues = new WeakMap<EnvironmentHandle, Promise<unknown>>();
const backgroundLogs = new WeakMap<EnvironmentHandle, string>();

function serialize<T>(env: EnvironmentHandle, fn: () => Promise<T>): Promise<T> {
  const previous = toolQueues.get(env) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(fn);
  toolQueues.set(env, next);
  return next;
}

function looksLikeLogPath(output: string): boolean {
  return /^\/tmp\/devproc-\d+\.log$/.test(output.trim());
}

async function appendBackgroundLog(env: EnvironmentHandle, message: string): Promise<string> {
  const logPath = backgroundLogs.get(env);
  if (!logPath) return message;
  const buf = await env.readFile(logPath).catch(() => null);
  if (!buf) return `${message}\n\nBackground log ${logPath}: not readable`;
  const log = buf.toString('utf8').trim();
  return `${message}\n\nBackground log ${logPath}:\n${log.slice(-3000) || '(empty)'}`;
}

function normalizeGeneratedContent(content: string): string {
  if (!content.includes('\\n') || content.includes('\n')) return content;
  return content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
}

// Keep generated Vite/React scaffolds runnable: pin compatible versions and a
// remote-host-friendly vite.config. Preserved verbatim from the old harnesses.
function normalizeGeneratedFile(filePath: string, content: string): string {
  const normalized = normalizeGeneratedContent(content);
  if (filePath === 'vite.config.js' || filePath === 'vite.config.mjs') {
    if (!normalized.includes('@vitejs/plugin-react') && !normalized.includes('vite')) return normalized;
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  }
});
`;
  }
  if (filePath !== 'package.json') return normalized;
  try {
    const pkg = JSON.parse(normalized) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}) };
    const devDeps = { ...(pkg.devDependencies ?? {}) };
    const hasReact = 'react' in deps || 'react-dom' in deps || 'react' in devDeps || 'react-dom' in devDeps;
    const hasVite = 'vite' in deps || 'vite' in devDeps || '@vitejs/plugin-react' in devDeps;
    if (!hasReact && !hasVite) return normalized;
    deps.react = '^18.3.1';
    deps['react-dom'] = '^18.3.1';
    delete devDeps.react;
    delete devDeps['react-dom'];
    devDeps.vite = '^5.4.0';
    devDeps['@vitejs/plugin-react'] = '^4.3.0';
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    pkg.scripts = { dev: 'vite', ...(pkg.scripts ?? {}) };
    return `${JSON.stringify(pkg, null, 2)}\n`;
  } catch {
    return normalized;
  }
}

const ok = (content: string): ToolResult => ({ content, isError: false });
const fail = (content: string): ToolResult => ({ content, isError: true });

// ── env-routed tools (OpenCode parity) ───────────────────────────────────────

registerTool('read', () => ({
  ref: 'read',
  description: 'Read a file from the workspace. Returns its contents or an empty marker.',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Relative file path to read.' } },
    required: ['path'],
    additionalProperties: false,
  },
  execute: (input, env) =>
    serialize(env, async () => {
      const buf = await env.readFile(String(input.path ?? ''));
      return ok(buf ? buf.toString('utf8') : '(empty or not found)');
    }),
}));

registerTool('write', () => ({
  ref: 'write',
  description: 'Create or overwrite a file in the workspace. Use relative paths (e.g. "src/App.jsx").',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path within the workspace.' },
      content: { type: 'string', description: 'Full file contents.' },
    },
    required: ['path', 'content'],
    additionalProperties: false,
  },
  execute: (input, env) =>
    serialize(env, async () => {
      const path = String(input.path ?? '');
      const content = normalizeGeneratedFile(path, String(input.content ?? ''));
      await env.writeFiles([{ path, content }]);
      return ok(`wrote ${path} (${content.length} bytes)`);
    }),
}));

registerTool('edit', () => ({
  ref: 'edit',
  description:
    'Replace the first occurrence of old_string with new_string in an existing workspace file. ' +
    'old_string must match exactly. Prefer this over rewriting whole files for small changes.',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path to edit.' },
      old_string: { type: 'string', description: 'Exact text to find.' },
      new_string: { type: 'string', description: 'Replacement text.' },
    },
    required: ['path', 'old_string', 'new_string'],
    additionalProperties: false,
  },
  execute: (input, env) =>
    serialize(env, async () => {
      const path = String(input.path ?? '');
      const oldStr = String(input.old_string ?? '');
      const newStr = String(input.new_string ?? '');
      const buf = await env.readFile(path);
      if (!buf) return fail(`file not found: ${path}`);
      const cur = buf.toString('utf8');
      if (oldStr && !cur.includes(oldStr)) return fail(`old_string not found in ${path}`);
      await env.writeFiles([{ path, content: cur.replace(oldStr, newStr) }]);
      return ok(`edited ${path}`);
    }),
}));

registerTool('bash', () => ({
  ref: 'bash',
  description:
    'Run a shell command in the workspace (e.g. "npm install", "npm run build"). ' +
    'For a long-running dev server set background:true so it does not block. ' +
    'Returns stdout/stderr/exitCode for foreground commands.',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: {
      cmd: { type: 'string', description: 'The shell command to run.' },
      background: { type: 'boolean', description: 'Run detached (use for dev servers). Default false.' },
    },
    required: ['cmd'],
    additionalProperties: false,
  },
  execute: (input, env) =>
    serialize(env, async () => {
      const cmd = String(input.cmd ?? '');
      const background = Boolean(input.background);
      const r = await env.exec(cmd, { detached: background, timeoutMs: 240_000 });
      if (isProcessHandle(r)) return ok(`started in background: ${cmd}`);
      if (background && r.exitCode === 0 && looksLikeLogPath(r.stdout)) {
        backgroundLogs.set(env, r.stdout.trim());
      }
      const out = (r.stdout + (r.stderr ? `\n[stderr]\n${r.stderr}` : '')).slice(-4000);
      return { content: `exitCode=${r.exitCode}\n${out}`, isError: r.exitCode !== 0 };
    }),
}));

registerTool('expose_port', () => ({
  ref: 'expose_port',
  description:
    'Expose a port the running dev server listens on and get back a public preview URL. ' +
    'Call this AFTER the dev server is started so the user sees the live app.',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: { port: { type: 'number', description: 'The port the dev server listens on.' } },
    required: ['port'],
    additionalProperties: false,
  },
  execute: (input, env, io: RunIO) =>
    serialize(env, async () => {
      const port = Number(input.port ?? 0);
      try {
        await env.waitForPort?.(port, 60_000);
      } catch (err) {
        return fail(await appendBackgroundLog(env, err instanceof Error ? err.message : String(err)));
      }
      const { url } = await env.exposePort(port);
      io.emit({ type: 'preview_ready', url, port }); // semantic event owned by the tool
      return ok(`Preview URL: ${url}`);
    }),
}));

// ── control-plane tools (ignore env) ─────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

registerTool('webfetch', () => ({
  ref: 'webfetch',
  description: 'Fetch a URL over HTTP and return its text (HTML stripped to readable text).',
  needsEnv: false,
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: 'Absolute http(s) URL to fetch.' } },
    required: ['url'],
    additionalProperties: false,
  },
  execute: async (input): Promise<ToolResult> => {
    const url = String(input.url ?? '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      const body = await res.text();
      const ct = res.headers.get('content-type') ?? '';
      const text = ct.includes('html') ? stripHtml(body) : body;
      return { content: `[${res.status}] ${text.slice(0, 8000)}`, isError: !res.ok };
    } catch (err) {
      return fail(`webfetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  },
}));

registerTool('websearch', () => ({
  ref: 'websearch',
  description: 'Search the web and return the top results (title + url + snippet).',
  needsEnv: false,
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'The search query.' } },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input): Promise<ToolResult> => {
    const query = String(input.query ?? '');
    const key = process.env.TAVILY_API_KEY;
    if (!key) return fail('websearch is not configured (set TAVILY_API_KEY in the harness env).');
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: key, query, max_results: 5, include_answer: false }),
      });
      if (!res.ok) return fail(`websearch error: HTTP ${res.status}`);
      const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
      const lines = (data.results ?? []).map(
        (r, i) => `${i + 1}. ${r.title ?? '(untitled)'}\n   ${r.url ?? ''}\n   ${(r.content ?? '').slice(0, 300)}`
      );
      return ok(lines.length ? lines.join('\n\n') : '(no results)');
    } catch (err) {
      return fail(`websearch error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
}));

// ── browser (playwright-style) ───────────────────────────────────────────────
// Routes through env.exec: writes a tiny CJS driver into the workspace and runs
// it with node + playwright. Returns the page title + visible text — text-shaped
// so it feeds back to the model (unlike a screenshot). Requires playwright in the
// env; if absent, returns an actionable install hint instead of throwing.

const BROWSER_DRIVER = `const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 30000 });
  const title = await page.title();
  let text = '';
  try { text = (await page.innerText('body')).slice(0, 4000); } catch {}
  console.log(JSON.stringify({ title, text }));
  await browser.close();
})().catch((e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });
`;

registerTool('browser', () => ({
  ref: 'browser',
  description:
    'Open a URL in a headless browser and return the page title + visible text. ' +
    'Use to verify a generated app actually renders (visual QA) after expose_port.',
  needsEnv: true,
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: 'The URL to open (e.g. the preview URL).' } },
    required: ['url'],
    additionalProperties: false,
  },
  execute: (input, env) =>
    serialize(env, async () => {
      const url = String(input.url ?? '');
      await env.writeFiles([{ path: '.kernel-browser.cjs', content: BROWSER_DRIVER }]);
      const r = await env.exec(`node .kernel-browser.cjs ${JSON.stringify(url)}`, { timeoutMs: 60_000 });
      if (isProcessHandle(r)) return fail('browser unexpectedly ran in background');
      if (r.exitCode !== 0) {
        const err = r.stderr || r.stdout;
        if (/Cannot find module 'playwright'/.test(err)) {
          return fail('Playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
        }
        return fail(`browser error: ${err.slice(-800)}`);
      }
      return ok(r.stdout.trim().slice(-4000));
    }),
}));
