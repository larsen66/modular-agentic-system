// src/harnesses/cli/run-cli.ts
// Shared engine for the CLI harnesses (`hermes-cli`, `claude-cli`, `codex-cli`).
//
// Unlike the SDK harness (mode 1: agent loop in-process, tool calls routed OUT
// to the handle), the CLI binary IS the whole agent loop AND the file-writer. It
// runs with the harness-selected auth path and writes the app directly into its
// cwd. So the integration is:
//
//   1) point the CLI's cwd at the env's host workspace dir (LOCAL env only)
//   2) run the CLI headless; translate its JSON event stream → EngineEvents
//   3) the CLI has now written the app to the workspace
//   4) install deps + start the dev server via env.exec (detached)
//   5) env.exposePort(port) → emit preview_ready so the iframe goes live
//
// SECURITY: we never read/print/log any token. Claude/Codex rely on stored CLI
// logins; provider-specific harnesses may intentionally pass through their own
// env such as OPENROUTER_API_KEY.

import { spawn } from 'node:child_process';
import type { EnvironmentHandle, RunIO, RunTask } from '../../types/index.js';
import { isLocalWorkspaceHandle } from '../../environments/local/index.js';

const DEV_PORT = 5173; // Vite default; the harness pins the dev server to it

// A scaffold + build instruction the CLI follows. We ask it ONLY to write files
// (deterministic, fast) — the harness owns install + dev-server + expose so the
// preview lifecycle is the SAME for every CLI and never depends on the model
// remembering to bind 0.0.0.0 / pick the right port.
function buildPrompt(userPrompt: string): string {
  return (
    `Create a minimal but real, runnable Vite + React (JavaScript) app in the CURRENT directory ` +
    `that satisfies this request:\n\n${userPrompt}\n\n` +
    `Requirements:\n` +
    `- Write these files: package.json (with react, react-dom, @vitejs/plugin-react, vite; ` +
    `scripts dev/build/preview), index.html, vite.config.js, src/main.jsx, src/App.jsx.\n` +
    `- Keep it self-contained: no extra dependencies beyond react/react-dom/vite unless essential.\n` +
    `- Do NOT run npm install and do NOT start any dev server — only write the files.\n` +
    `- Write the files directly; do not ask questions.`
  );
}

function normalizePackageJson(raw: string): string {
  try {
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}) };
    const devDeps = { ...(pkg.devDependencies ?? {}) };
    const hasReact =
      'react' in deps || 'react-dom' in deps || 'react' in devDeps || 'react-dom' in devDeps;
    const hasVite = 'vite' in deps || 'vite' in devDeps || '@vitejs/plugin-react' in devDeps;
    if (!hasReact && !hasVite) return raw;

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
    return raw;
  }
}

function normalizeViteConfig(raw: string): string {
  if (!raw.includes('@vitejs/plugin-react') && !raw.includes('vite')) return raw;
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

export interface CliSpec {
  ref: string;
  // Build the argv (after the binary) for a headless, file-writing run in cwd.
  buildArgs: (prompt: string) => string[];
  bin: string; // 'claude' | 'codex'
  // Most local-login CLIs must stay on the host. Hermes can also run inside a
  // sandbox when the selected environment image/template has the binary and
  // provider env vars are injected.
  sandboxSupported?: boolean;
  sandboxInstallHint?: string;
  authDescription?: string | (() => string);
  // Parse one stdout line of the CLI's stream into normalized events. Return the
  // events to emit for that line (may be empty). Keep it tolerant: unknown lines
  // are ignored. NEVER surface secrets.
  parseLine: (line: string) => ParsedCliEvent[];
  // Token usage extraction is best-effort; the CLI may not report it.
}

export type ParsedCliEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool_call'; name: string; callId?: string; argsSummary?: string }
  | { kind: 'tool_result'; ok: boolean; output?: string; callId?: string }
  | { kind: 'usage'; inputTokens: number; outputTokens: number };

// Run the CLI binary in `cwd`, streaming its stdout lines through `onLine`.
// Resolves with the exit code. Inherits the parent env minus direct Anthropic /
// OpenAI SDK keys. OPENROUTER_API_KEY is left available for Hermes/OpenRouter.
function runBinary(
  bin: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  onLine: (line: string) => void,
  onStderr: (chunk: string) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Strip direct model keys from the child env: Claude/Codex should use their
    // stored login. OpenRouter stays available for harnesses that explicitly ask
    // their CLI to use that provider.
    const childEnv = { ...process.env };
    delete childEnv.ANTHROPIC_API_KEY;
    delete childEnv.OPENAI_API_KEY;

    const child = spawn(bin, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';

    child.stdout.on('data', (c: Buffer) => {
      buf += c.toString('utf8');
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) onLine(line);
      }
    });
    child.stderr.on('data', (c: Buffer) => onStderr(c.toString('utf8')));

    const onAbort = () => child.kill('SIGTERM');
    signal.addEventListener('abort', onAbort, { once: true });

    child.on('error', (err) => {
      signal.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (buf.trim()) onLine(buf); // flush trailing partial line
      resolve(code ?? 0);
    });
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function emitParsedLine(spec: CliSpec, line: string, io: RunIO, usage: { inTok: number; outTok: number }): void {
  for (const ev of spec.parseLine(line)) {
    if (ev.kind === 'text') io.emit({ type: 'stream_chunk', text: ev.text });
    else if (ev.kind === 'tool_call')
      io.emit({
        type: 'tool_call',
        name: ev.name,
        args: ev.argsSummary ? { summary: ev.argsSummary } : undefined,
        callId: ev.callId,
      });
    else if (ev.kind === 'tool_result')
      io.emit({ type: 'tool_result', ok: ev.ok, output: ev.output, callId: ev.callId });
    else if (ev.kind === 'usage') {
      usage.inTok += ev.inputTokens;
      usage.outTok += ev.outputTokens;
    }
  }
}

function lineSink(onLine: (line: string) => void): { write: (chunk: string) => void; flush: () => void } {
  let buf = '';
  return {
    write(chunk: string) {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) onLine(line);
      }
    },
    flush() {
      if (buf.trim()) onLine(buf);
      buf = '';
    },
  };
}

export async function runCliHarness(
  spec: CliSpec,
  task: RunTask,
  env: EnvironmentHandle,
  io: RunIO
): Promise<void> {
  const log = (level: 'info' | 'warn' | 'error', message: string) =>
    io.emit({ type: 'log', category: 'harness', level, message, at: Date.now() });

  const localEnv = isLocalWorkspaceHandle(env);
  if (!localEnv && !spec.sandboxSupported) {
    log('error', `${spec.ref} requires the "local" environment (CLI writes via a host-local login)`);
    io.emit({
      type: 'terminal',
      cause: 'error',
      error: {
        code: 'env_unsupported',
        message: `${spec.ref} harness requires environment "local".`,
      },
    });
    return;
  }
  const cwd = localEnv ? env.hostPath() : undefined;

  const usage = { inTok: 0, outTok: 0 };

  // 1) Run the CLI headless in the workspace.
  const authDescription =
    typeof spec.authDescription === 'function'
      ? spec.authDescription()
      : spec.authDescription ?? 'existing login, no API key';
  const args = spec.buildArgs(buildPrompt(task.prompt));
  let exitCode = 0;

  if (localEnv) {
    log('info', `invoking ${spec.bin} on host (headless, ${authDescription})`);
    try {
      exitCode = await runBinary(
        spec.bin,
        args,
        cwd!,
        task.signal,
        (line) => emitParsedLine(spec, line, io, usage),
        (chunk) => {
          // CLI diagnostics → activity log (warn). Never the model output channel.
          const t = chunk.trim();
          if (t) log('warn', `${spec.bin}: ${t.slice(0, 200)}`);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', `${spec.bin} failed to start: ${message}`);
      io.emit({ type: 'terminal', cause: 'error', error: { code: 'cli_spawn_failed', message } });
      return;
    }
  } else {
    const check = await env.exec(`command -v ${shellQuote(spec.bin)}`, { timeoutMs: 30_000 });
    if ('poll' in check || check.exitCode !== 0) {
      const hint = spec.sandboxInstallHint ? ` ${spec.sandboxInstallHint}` : '';
      const message = `${spec.bin} is not installed inside the selected environment.${hint}`;
      log('error', message);
      io.emit({ type: 'terminal', cause: 'error', error: { code: 'cli_missing_in_env', message } });
      return;
    }

    log('info', `invoking ${spec.bin} inside environment (headless, ${authDescription})`);
    const stdout = lineSink((line) => emitParsedLine(spec, line, io, usage));
    const stderr = lineSink((line) => log('warn', `${spec.bin}: ${line.slice(0, 200)}`));
    const cmd = [spec.bin, ...args].map(shellQuote).join(' ');
    const result = await env.exec(cmd, {
      timeoutMs: 300_000,
      onStdout: (chunk) => stdout.write(chunk),
      onStderr: (chunk) => stderr.write(chunk),
    });
    stdout.flush();
    stderr.flush();
    if ('poll' in result) {
      log('error', `${spec.bin} returned a background process for a foreground run`);
      io.emit({
        type: 'terminal',
        cause: 'error',
        error: { code: 'cli_exec_failed', message: `${spec.bin} did not return an exit code.` },
      });
      return;
    }
    exitCode = result.exitCode;
  }

  if (task.signal.aborted) {
    io.emit({ type: 'terminal', cause: 'cancelled' });
    return;
  }
  if (exitCode !== 0) {
    log('error', `${spec.bin} exited with code ${exitCode}`);
    io.emit({
      type: 'terminal',
      cause: 'error',
      error: { code: 'cli_nonzero_exit', message: `${spec.bin} exited ${exitCode}` },
    });
    return;
  }

  // 2) Verify the CLI actually produced a project to serve.
  const pkg = await env.readFile('package.json');
  if (!pkg) {
    log('error', 'CLI produced no package.json — nothing to preview');
    io.emit({
      type: 'terminal',
      cause: 'error',
      error: { code: 'no_app_generated', message: 'CLI did not generate package.json.' },
    });
    return;
  }
  const normalizedPkg = normalizePackageJson(pkg.toString('utf8'));
  if (normalizedPkg !== pkg.toString('utf8')) {
    await env.writeFiles([{ path: 'package.json', content: normalizedPkg }]);
    log('info', 'normalized package.json dependencies for Vite/React preview');
  }
  const viteConfig = await env.readFile('vite.config.js');
  if (viteConfig) {
    const normalizedViteConfig = normalizeViteConfig(viteConfig.toString('utf8'));
    if (normalizedViteConfig !== viteConfig.toString('utf8')) {
      await env.writeFiles([{ path: 'vite.config.js', content: normalizedViteConfig }]);
      log('info', 'normalized Vite dev-server config for remote previews');
    }
  }
  log('info', 'app files generated — installing dependencies');

  // 3) Install deps (foreground, bounded).
  const installCmd = 'npm install --cache .npm-cache --no-audit --no-fund';
  io.emit({ type: 'tool_call', name: 'run_command', args: { cmd: installCmd } });
  const install = await env.exec(installCmd, {
    cwd,
    timeoutMs: 240_000,
  });
  const installOk = !('poll' in install) && install.exitCode === 0;
  io.emit({
    type: 'tool_result',
    ok: installOk,
    output: installOk
      ? 'dependencies installed'
      : `npm install failed\n${!('poll' in install) ? `${install.stdout}\n${install.stderr}`.trim().slice(-1200) : ''}`,
  });
  if (!installOk) {
    const detail = !('poll' in install) ? `${install.stdout}\n${install.stderr}`.trim().slice(-400) : '';
    log('error', `npm install failed${detail ? `: ${detail}` : ''}`);
    io.emit({
      type: 'terminal',
      cause: 'error',
      error: { code: 'install_failed', message: 'npm install failed.' },
    });
    return;
  }

  // 4) Start the dev server detached, pinned to a known host/port.
  const host = localEnv ? '127.0.0.1' : '0.0.0.0';
  const cmd = `npm run dev -- --host ${host} --port ${DEV_PORT} --strictPort`;
  io.emit({ type: 'tool_call', name: 'run_command', args: { cmd, background: true } });
  await env.exec(cmd, { cwd, detached: true });
  io.emit({ type: 'tool_result', ok: true, output: `[started] dev server on :${DEV_PORT}` });

  // 5) Wait for readiness, then expose → live preview.
  try {
    await env.waitForPort?.(DEV_PORT, 60_000);
    const { url } = await env.exposePort(DEV_PORT);
    io.emit({ type: 'preview_ready', url, port: DEV_PORT });
    io.emit({ type: 'final_text', text: `Live preview ready at ${url}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `dev server did not become ready: ${message}`);
    io.emit({
      type: 'terminal',
      cause: 'error',
      error: { code: 'preview_failed', message },
    });
    return;
  }

  io.emit({ type: 'usage_delta', inputTokens: usage.inTok, outputTokens: usage.outTok });
  io.emit({ type: 'terminal', cause: 'done' });
}

export { DEV_PORT };
