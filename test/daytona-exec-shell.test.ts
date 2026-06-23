import { describe, expect, it, vi } from 'vitest';
import { DaytonaHandle } from '../src/environments/daytona/index.js';

function sandbox() {
  return {
    process: {
      executeCommand: vi.fn().mockResolvedValue({ exitCode: 0, result: 'pong' }),
      createSession: vi.fn().mockResolvedValue(undefined),
      executeSessionCommand: vi.fn().mockResolvedValue({ cmdId: 'cmd-1' }),
      getSessionCommand: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('Daytona exec shell portability', () => {
  it('runs foreground commands through /bin/sh and overrides inherited SHELL', async () => {
    const s = sandbox();
    const handle = new DaytonaHandle('s1', s as any);

    const result = await handle.exec("echo 'pong'", { env: { SHELL: '/usr/bin/zsh' } });

    expect(result).toMatchObject({ exitCode: 0, stdout: 'pong' });
    expect(s.process.executeCommand).toHaveBeenCalledWith(
      "/bin/sh -lc 'cd '\\''workspace'\\'' && echo '\\''pong'\\'''",
      undefined,
      { SHELL: '/bin/sh' },
      undefined
    );
  });

  it('runs background session commands through /bin/sh with a quoted cwd', async () => {
    const s = sandbox();
    const handle = new DaytonaHandle('s1', s as any);

    await handle.exec('npm run dev -- --host 0.0.0.0 --port 5173', {
      cwd: 'workspace/app dir',
      detached: true,
    });

    expect(s.process.executeSessionCommand).toHaveBeenCalledWith(
      expect.stringMatching(/^dev-/),
      {
        command:
          "/bin/sh -lc 'cd '\\''workspace/app dir'\\'' && npm run dev -- --host 0.0.0.0 --port 5173'",
        runAsync: true,
      }
    );
  });
});
