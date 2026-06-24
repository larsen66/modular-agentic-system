// src/harnesses/openai-agents/execEngine.ts
// The injectable-execution core, shared by BOTH code paths:
//   • the real @openai/agents function tools (tools.ts), and
//   • the harness-specific verifier that drives the same tool seam.
//
// This is the seam: each of the four actions routes OUT to the opaque
// EnvironmentHandle and narrates itself into the EngineEvent stream
// (tool_call/tool_result + preview_ready). The model decides what to call; the
// kernel and env are untouched by which harness drove the call.

import type { EnvironmentHandle, RunIO } from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';

// JSON-Schema parameter definitions (plain objects, no Zod dependency). Shared by
// both paths: the SDK tool() receives these as `parameters`, and the fetch loop
// sends them as OpenAI `function.parameters`.
export const TOOL_SCHEMAS = {
  write_file: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path within the workspace.' },
      content: { type: 'string', description: 'Full file contents.' },
    },
    required: ['path', 'content'] as string[],
    additionalProperties: false,
  },
  run_command: {
    type: 'object',
    properties: {
      cmd: { type: 'string', description: 'The shell command to run.' },
      background: {
        type: 'boolean',
        description: 'Run detached (use for dev servers). Default false.',
      },
    },
    required: ['cmd', 'background'] as string[],
    additionalProperties: false,
  },
  read_file: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Relative file path to read.' } },
    required: ['path'] as string[],
    additionalProperties: false,
  },
  expose_port: {
    type: 'object',
    properties: { port: { type: 'number', description: 'The port the dev server listens on.' } },
    required: ['port'] as string[],
    additionalProperties: false,
  },
} as const;

export const TOOL_DESCRIPTIONS = {
  write_file:
    'Create or overwrite a file in the project workspace. Use relative paths (e.g. "src/App.jsx").',
  run_command:
    'Run a shell command in the workspace (e.g. "npm install", "npm run build"). ' +
    'For a long-running dev server set background:true so it does not block. ' +
    'Returns stdout/stderr/exitCode for foreground commands.',
  read_file: 'Read a file from the workspace. Returns its contents or an empty string.',
  expose_port:
    'Expose a port the running dev server listens on and get back a public preview URL. ' +
    'Call this AFTER the dev server is started so the user can see the live app.',
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

// One opaque call id per invocation so the tool_call/tool_result pair correlates
// in the UI. The provider call id is not always handed to the tool body, so we
// mint our own — purely for our event stream's correlation.
let callSeq = 0;
const nextCallId = (name: string): string => `oa_${name}_${++callSeq}`;
const backgroundLogs = new WeakMap<EnvironmentHandle, string>();
const toolQueues = new WeakMap<EnvironmentHandle, Promise<unknown>>();

function normalizeGeneratedContent(content: string): string {
  if (!content.includes('\\n') || content.includes('\n')) return content;
  return content
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"');
}

function normalizeGeneratedFile(filePath: string, content: string): string {
  const normalized = normalizeGeneratedContent(content);
  if (filePath === 'vite.config.js' || filePath === 'vite.config.mjs') {
    if (!normalized.includes('@vitejs/plugin-react') && !normalized.includes('vite')) return normalized;
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    const hasReact =
      'react' in deps || 'react-dom' in deps || 'react' in devDeps || 'react-dom' in devDeps;
    const hasVite = 'vite' in deps || 'vite' in devDeps || '@vitejs/plugin-react' in devDeps;
    if (!hasReact && !hasVite) return normalized;

    // Pin the React/Vite toolchain the model chose to compatible versions
    // (install-success guardrail). Do NOT impose a UI/styling stack: only pin
    // packages the model actually declared, so the app is built from the task
    // rather than forced into HeroUI/Tailwind.
    if (hasReact) {
      deps.react = '^19.0.0';
      deps['react-dom'] = '^19.0.0';
      delete devDeps.react;
      delete devDeps['react-dom'];
    }
    if (hasVite) {
      devDeps.vite = '^5.4.0';
      devDeps['@vitejs/plugin-react'] = '^4.3.0';
    }
    if ('@heroui/react' in deps || '@heroui/react' in devDeps) deps['@heroui/react'] = '^3.2.1';
    if (
      'tailwindcss' in deps ||
      'tailwindcss' in devDeps ||
      '@tailwindcss/vite' in deps ||
      '@tailwindcss/vite' in devDeps
    ) {
      deps.tailwindcss = '^4.0.0';
      delete devDeps.tailwindcss;
      devDeps['@tailwindcss/vite'] = '^4.0.0';
    }
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    if (hasVite) pkg.scripts = { dev: 'vite', ...(pkg.scripts ?? {}) };
    return `${JSON.stringify(pkg, null, 2)}\n`;
  } catch {
    return normalized;
  }
}

function looksLikeLogPath(output: string): boolean {
  return /^\/tmp\/devproc-\d+\.log$/.test(output.trim());
}

function isInstallCommand(cmd: string): boolean {
  return /(^|\s)(npm|pnpm|yarn)\s+(install|i)(\s|$)/.test(cmd);
}

function isDevServerCommand(cmd: string): boolean {
  return /(^|\s)(npm|pnpm|yarn)\s+run\s+dev(\s|$)/.test(cmd) || /(^|\s)vite(\s|$)/.test(cmd);
}

function isForegroundOnlyCommand(cmd: string): boolean {
  return (
    isInstallCommand(cmd) ||
    /(^|\s)(npm|pnpm|yarn)\s+run\s+(build|test|lint|typecheck)(\s|$)/.test(cmd)
  );
}

async function missingFiles(env: EnvironmentHandle, paths: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const path of paths) {
    if (!(await env.readFile(path))) missing.push(path);
  }
  return missing;
}

async function validateRunCommand(cmd: string, background: boolean, env: EnvironmentHandle): Promise<string | null> {
  if (background && isForegroundOnlyCommand(cmd)) {
    return `Do not run "${cmd}" in background. Write the app files first, then run dependency/build commands in the foreground with background:false.`;
  }

  if (isInstallCommand(cmd)) {
    const missing = await missingFiles(env, ['package.json']);
    if (missing.length) return `Cannot run "${cmd}" before package.json exists. Write package.json first.`;
  }

  if (isDevServerCommand(cmd)) {
    const missing = await missingFiles(env, [
      'package.json',
      'vite.config.js',
      'index.html',
      'src/main.jsx',
      'src/App.jsx',
      'package-lock.json',
    ]);
    if (missing.length) {
      return `Cannot start the dev server yet. Missing: ${missing.join(', ')}. Write the app files and run npm install in the foreground first.`;
    }
    if (!background) return `Run the dev server with background:true so the tool call can return and expose_port can run.`;
  }

  return null;
}

async function appendBackgroundLog(env: EnvironmentHandle, message: string): Promise<string> {
  const logPath = backgroundLogs.get(env);
  if (!logPath) return message;
  const buf = await env.readFile(logPath).catch(() => null);
  if (!buf) return `${message}\n\nBackground log ${logPath}: not readable`;
  const log = buf.toString('utf8').trim();
  return `${message}\n\nBackground log ${logPath}:\n${log.slice(-3000) || '(empty)'}`;
}

/**
 * Execute one named tool against the environment handle, emitting the
 * tool_call/tool_result (and preview_ready) EngineEvents. Returns the string the
 * model should see as the tool result. NEVER throws — tool errors are returned
 * as text so the agent loop can recover. This is the single execution authority
 * both paths call.
 */
export async function executeTool(
  name: string,
  input: unknown,
  env: EnvironmentHandle,
  io: RunIO
): Promise<string> {
  const previous = toolQueues.get(env) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => executeToolNow(name, input, env, io));
  toolQueues.set(env, next);
  return next;
}

async function executeToolNow(
  name: string,
  input: unknown,
  env: EnvironmentHandle,
  io: RunIO
): Promise<string> {
  const args = asRecord(input);
  const callId = nextCallId(name);

  try {
    if (name === 'write_file') {
      const path = String(args.path ?? '');
      const content = normalizeGeneratedFile(path, String(args.content ?? ''));
      io.emit({ type: 'tool_call', name, args: { path }, callId });
      await env.writeFiles([{ path, content }]);
      io.emit({ type: 'tool_result', ok: true, output: `wrote ${path}`, callId });
      return `wrote ${path} (${content.length} bytes)`;
    }

    if (name === 'run_command') {
      const cmd = String(args.cmd ?? '');
      const background = Boolean(args.background);
      io.emit({ type: 'tool_call', name, args: { cmd, background }, callId });
      const validationError = await validateRunCommand(cmd, background, env);
      if (validationError) {
        io.emit({ type: 'tool_result', ok: false, output: validationError.slice(0, 800), callId });
        return validationError;
      }
      const r = await env.exec(cmd, { detached: background, timeoutMs: 240_000 });
      if (isProcessHandle(r)) {
        io.emit({ type: 'tool_result', ok: true, output: `[started] ${cmd}`, callId });
        return `started in background: ${cmd}`;
      }
      if (background && r.exitCode === 0 && looksLikeLogPath(r.stdout)) {
        backgroundLogs.set(env, r.stdout.trim());
      }
      const ok = r.exitCode === 0;
      const out = (r.stdout + (r.stderr ? `\n[stderr]\n${r.stderr}` : '')).slice(-4000);
      io.emit({ type: 'tool_result', ok, output: out.slice(0, 800), callId });
      return `exitCode=${r.exitCode}\n${out}`;
    }

    if (name === 'read_file') {
      const path = String(args.path ?? '');
      io.emit({ type: 'tool_call', name, args: { path }, callId });
      const buf = await env.readFile(path);
      const content = buf ? buf.toString('utf8') : '';
      io.emit({ type: 'tool_result', ok: true, output: `read ${path}`, callId });
      return content || '(empty or not found)';
    }

    if (name === 'expose_port') {
      const port = Number(args.port ?? 0);
      io.emit({ type: 'tool_call', name, args: { port }, callId });
      try {
        await env.waitForPort?.(port, 60_000);
      } catch (err) {
        throw new Error(await appendBackgroundLog(env, err instanceof Error ? err.message : String(err)));
      }
      const { url } = await env.exposePort(port);
      io.emit({ type: 'preview_ready', url, port });
      io.emit({ type: 'tool_result', ok: true, output: url, callId });
      return `Preview URL: ${url}`;
    }

    io.emit({ type: 'tool_result', ok: false, output: `unknown tool ${name}`, callId });
    return `unknown tool: ${name}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    io.emit({ type: 'tool_result', ok: false, output: message.slice(0, 800), callId });
    return `tool error: ${message}`;
  }
}

export const SYSTEM_INSTRUCTIONS = `You are a senior full-stack engineer working inside a fresh sandbox workspace.
Your job: take the user's request and produce a REAL, runnable web app, then start its dev server and expose it so the user sees a live preview.

Rules:
- Build whatever stack best fits the user's request. Keep it minimal but real and working — no placeholders, no "describe only".
- Use the tools to actually create files, install dependencies, and start the dev server. Do not just describe steps — perform them.
- The dev server MUST listen on 0.0.0.0 (not just localhost) and on the port you will expose, and it must accept remote sandbox preview hosts (e.g. for Vite set server.allowedHosts=true).
- When the app is running and the port is exposed, give a one-paragraph summary and stop.
Be concise in your text; let the tools do the work.`;
