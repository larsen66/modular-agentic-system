import { describe, expect, it } from 'vitest';
import { runCliHarness, type CliSpec } from '../src/harnesses/cli/run-cli.js';
import type {
  EngineEvent,
  EnvironmentCapabilities,
  EnvironmentHandle,
  ExecOpts,
  ExecResult,
  ProcessHandle,
  RunTask,
} from '../src/types/index.js';

const CAPS: EnvironmentCapabilities = {
  publicPorts: true,
  pty: false,
  snapshot: false,
  nativeGit: false,
  fileWatch: false,
  persistentVolume: false,
  hostsAgentRuntime: true,
};

class FakeSandboxHandle implements EnvironmentHandle {
  readonly id = 'fake-sandbox';
  readonly capabilities = CAPS;
  readonly commands: string[] = [];
  private files = new Map<string, Buffer>();

  constructor(private readonly hasHermes = true) {}

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    this.commands.push(cmd);
    if (cmd === "command -v 'hermes'") {
      return { exitCode: this.hasHermes ? 0 : 1, stdout: this.hasHermes ? '/usr/bin/hermes' : '', stderr: '' };
    }
    if (cmd.startsWith("'hermes' ")) {
      opts?.onStdout?.('generated app\n');
      this.files.set(
        'package.json',
        Buffer.from(JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { react: '^18.3.1' }, devDependencies: { vite: '^5.4.0' } }))
      );
      this.files.set('vite.config.js', Buffer.from('import { defineConfig } from "vite";\n'));
      return { exitCode: 0, stdout: 'generated app', stderr: '' };
    }
    if (cmd.startsWith('npm install')) return { exitCode: 0, stdout: 'installed', stderr: '' };
    if (cmd.startsWith('npm run dev')) return { exitCode: 0, stdout: 'started', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    for (const file of files) {
      this.files.set(file.path, Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content));
    }
  }

  async readFile(path: string): Promise<Buffer | null> {
    return this.files.get(path) ?? null;
  }

  async exposePort(port: number): Promise<{ url: string }> {
    return { url: `http://localhost:${port}/` };
  }

  async waitForPort(): Promise<void> {}

  async destroy(): Promise<void> {}
}

function task(): RunTask {
  return {
    runId: 'test-run',
    prompt: 'build a tiny app',
    signal: new AbortController().signal,
    topology: 'agent-in-sandbox',
  };
}

function collectEvents(): { events: EngineEvent[]; emit: (ev: EngineEvent) => void } {
  const events: EngineEvent[] = [];
  return { events, emit: (ev) => events.push(ev) };
}

const HERMES_SPEC: CliSpec = {
  ref: 'hermes-cli',
  bin: 'hermes',
  sandboxSupported: true,
  buildArgs: (prompt) => ['chat', '--quiet', '-q', prompt],
  parseLine: (line) => [{ kind: 'text', text: line }],
};

describe('runCliHarness sandbox execution', () => {
  it('runs sandbox-supported Hermes through EnvironmentHandle.exec', async () => {
    const env = new FakeSandboxHandle();
    const io = collectEvents();

    await runCliHarness(HERMES_SPEC, task(), env, io);

    expect(env.commands[0]).toBe("command -v 'hermes'");
    expect(env.commands.some((cmd) => cmd.startsWith("'hermes' 'chat'"))).toBe(true);
    expect(env.commands).toContain('npm run dev -- --host 0.0.0.0 --port 5173 --strictPort');
    expect(io.events).toContainEqual({ type: 'terminal', cause: 'done' });
    expect(io.events.some((ev) => ev.type === 'preview_ready')).toBe(true);
  });

  it('rejects non-local environments for local-login-only CLI specs', async () => {
    const env = new FakeSandboxHandle();
    const io = collectEvents();

    await runCliHarness({ ...HERMES_SPEC, ref: 'codex-cli', sandboxSupported: false }, task(), env, io);

    expect(io.events).toContainEqual({
      type: 'terminal',
      cause: 'error',
      error: { code: 'env_unsupported', message: 'codex-cli harness requires environment "local".' },
    });
  });

  it('reports a clear error when Hermes is missing in the sandbox', async () => {
    const env = new FakeSandboxHandle(false);
    const io = collectEvents();

    await runCliHarness(HERMES_SPEC, task(), env, io);

    expect(io.events).toContainEqual({
      type: 'terminal',
      cause: 'error',
      error: { code: 'cli_missing_in_env', message: 'hermes is not installed inside the selected environment.' },
    });
  });
});
