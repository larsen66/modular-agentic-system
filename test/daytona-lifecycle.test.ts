import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const deleteMock = vi.fn();
const uploadFilesMock = vi.fn();
const createFolderMock = vi.fn();

vi.mock('@daytonaio/sdk', () => ({
  Daytona: vi.fn().mockImplementation(() => ({
    create: createMock,
  })),
}));

function sandbox(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sandbox-1',
    fs: { uploadFiles: uploadFilesMock, createFolder: createFolderMock },
    git: { clone: vi.fn() },
    process: {},
    delete: deleteMock,
    ...overrides,
  };
}

describe('Daytona environment lifecycle policy', () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    deleteMock.mockReset();
    deleteMock.mockResolvedValue(undefined);
    uploadFilesMock.mockReset();
    createFolderMock.mockReset();
    createFolderMock.mockResolvedValue(undefined);
    process.env.DAYTONA_API_KEY = 'dtn_test';
    delete process.env.DAYTONA_EPHEMERAL;
    delete process.env.DAYTONA_USER;
    delete process.env.DAYTONA_PERSIST_SANDBOX;
    delete process.env.DAYTONA_AUTO_STOP_MINUTES;
    delete process.env.DAYTONA_AUTO_ARCHIVE_MINUTES;
  });

  afterEach(() => {
    delete process.env.DAYTONA_API_KEY;
  });

  it('creates short-lived ephemeral sandboxes by default', async () => {
    createMock.mockResolvedValue(sandbox());
    const { DaytonaEnvironment } = await import('../src/environments/daytona/index.js');

    const env = new DaytonaEnvironment();
    await env.provision({ source: { kind: 'files', files: [] } });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        user: 'daytona',
        autoStopInterval: 15,
        autoDeleteInterval: 0,
        labels: expect.objectContaining({ 'modular-runner': 'true' }),
      })
    );
  });

  it('supports an explicit persistent debug mode with auto-archive', async () => {
    process.env.DAYTONA_USER = 'root';
    process.env.DAYTONA_PERSIST_SANDBOX = '1';
    process.env.DAYTONA_AUTO_ARCHIVE_MINUTES = '30';
    createMock.mockResolvedValue(sandbox());
    const { DaytonaEnvironment } = await import('../src/environments/daytona/index.js');

    const env = new DaytonaEnvironment();
    await env.provision({ source: { kind: 'files', files: [] } });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        autoStopInterval: 15,
        user: 'root',
        autoArchiveInterval: 30,
        autoDeleteInterval: -1,
      })
    );
    expect(createMock.mock.calls[0]![0]).not.toHaveProperty('ephemeral');
  });

  it('deletes a sandbox if materialization fails after create', async () => {
    uploadFilesMock.mockRejectedValue(new Error('upload failed'));
    createMock.mockResolvedValue(sandbox());
    const { DaytonaEnvironment } = await import('../src/environments/daytona/index.js');

    const env = new DaytonaEnvironment();
    await expect(
      env.provision({ source: { kind: 'files', files: [{ path: 'a.txt', content: 'a' }] } })
    ).rejects.toThrow(/upload failed/);

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('turns Daytona disk quota failures into an actionable provisioning error', async () => {
    createMock.mockRejectedValue(
      new Error('Total disk limit exceeded. Maximum allowed: 30GiB.')
    );
    const { DaytonaEnvironment } = await import('../src/environments/daytona/index.js');

    const env = new DaytonaEnvironment();
    await expect(env.provision({ source: { kind: 'files', files: [] } })).rejects.toThrow(
      /Archive or delete unused Daytona sandboxes/
    );
  });
});
