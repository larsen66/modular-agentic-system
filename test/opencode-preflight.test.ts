import { describe, expect, it } from 'vitest';
import { resolveHarness } from '../src/registry/index.js';
import type { EngineEvent, EnvironmentHandle, ExecOpts, ExecResult, ProcessHandle } from '../src/types/index.js';
import '../src/harnesses/opencode/index.js';

class MissingOpencodeEnv implements EnvironmentHandle {
  readonly id = 'missing-opencode';
  readonly capabilities = {
    publicPorts: true,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: true,
  };
  readonly commands: string[] = [];

  async exec(cmd: string, _opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    this.commands.push(cmd);
    if (cmd.includes('command -v opencode')) {
      return { exitCode: 127, stdout: '', stderr: 'opencode: not found' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }
  async writeFiles(): Promise<void> {}
  async readFile(): Promise<Buffer | null> {
    return null;
  }
  async exposePort(): Promise<{ url: string }> {
    return { url: 'http://127.0.0.1:4443' };
  }
  async destroy(): Promise<void> {}
}

describe('opencode harness preflight', () => {
  it('fails fast when the selected environment has no opencode CLI', async () => {
    const env = new MissingOpencodeEnv();
    const events: EngineEvent[] = [];
    const harness = resolveHarness('opencode');

    await harness.run(
      {
        runId: 'r-opencode-missing',
        prompt: 'hello',
        signal: new AbortController().signal,
        topology: 'agent-in-sandbox',
      },
      env,
      { emit: (ev) => events.push(ev) }
    );

    expect(env.commands).toEqual(['command -v opencode && opencode --version']);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'terminal',
        cause: 'error',
        error: expect.objectContaining({
          code: 'opencode_harness_error',
          message: expect.stringContaining('opencode CLI is not installed inside the selected environment'),
        }),
      })
    );
  });
});
