import { describe, expect, it } from 'vitest';
import { executeTool } from '../src/harnesses/openai-agents/execEngine.js';
import { buildKit } from '../src/registry/index.js';
import type {
  EngineEvent,
  EnvironmentCapabilities,
  EnvironmentHandle,
  ExecOpts,
  ExecResult,
  ProcessHandle,
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

class GuardEnv implements EnvironmentHandle {
  readonly id = 'guard-env';
  readonly capabilities = CAPS;
  readonly commands: string[] = [];
  private readonly files = new Map<string, Buffer>();

  constructor(files: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(path, Buffer.from(content));
    }
  }

  async exec(cmd: string, _opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    this.commands.push(cmd);
    return { exitCode: 0, stdout: 'ok', stderr: '' };
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

  async destroy(): Promise<void> {}
}

function io(): { events: EngineEvent[]; emit: (ev: EngineEvent) => void } {
  const events: EngineEvent[] = [];
  return { events, emit: (ev) => events.push(ev) };
}

describe('run command guardrails', () => {
  it('rejects background dependency installs before they reach the environment', async () => {
    const env = new GuardEnv({ 'package.json': '{}' });
    const out = io();

    const result = await executeTool('run_command', { cmd: 'npm install', background: true }, env, out);

    expect(result).toContain('Do not run "npm install" in background');
    expect(env.commands).toEqual([]);
    expect(out.events).toContainEqual({
      type: 'tool_result',
      ok: false,
      output: expect.stringContaining('Do not run "npm install" in background'),
      callId: expect.any(String),
    });
  });

  it('rejects dev server start until files and foreground install have completed', async () => {
    const env = new GuardEnv({
      'package.json': '{}',
      'vite.config.js': 'export default {}',
      'index.html': '<div id="root"></div>',
      'src/main.jsx': '',
      'src/App.jsx': '',
    });
    const out = io();

    const result = await executeTool(
      'run_command',
      { cmd: 'npm run dev -- --host 0.0.0.0 --port 5173', background: true },
      env,
      out
    );

    expect(result).toContain('package-lock.json');
    expect(env.commands).toEqual([]);
  });

  it('applies the same foreground-install guard to the shared bash ToolSpec', async () => {
    await import('../src/tools/index.js');
    const kit = buildKit(['bash'], []);
    const env = new GuardEnv({ 'package.json': '{}' });

    const result = await kit.byRef('bash')!.execute(
      { cmd: 'npm install', background: true },
      env,
      { emit() {} }
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Do not run "npm install" in background');
    expect(env.commands).toEqual([]);
  });
});
