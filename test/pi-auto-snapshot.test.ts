// Deterministic coverage for the PI end-of-run auto-snapshot (the "reopen chat →
// see the app" durability path). We stub an EnvironmentHandle with an in-memory
// FS so no live sandbox is needed: `tar czf` builds a real gzipped tarball the
// store can ingest, and `find` answers the build-dir / package.json probes.

import { describe, it, expect, beforeAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { pack as tarPack } from 'tar-stream';

// Point the snapshot-store singleton at a temp dir BEFORE importing the module
// that reads it (previewSnapshotStore() reads PREVIEW_SNAPSHOT_DIR on first call).
beforeAll(() => {
  process.env.PREVIEW_SNAPSHOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-autosnap-'));
});

import { captureStaticSnapshot, autoCaptureStaticSnapshot } from '../src/harnesses/pi/snapshotTool.js';
import type { EngineEvent, EnvironmentHandle, ExecResult, RunIO } from '../src/types/index.js';

function tarball(files: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = tarPack();
    const chunks: Buffer[] = [];
    p.on('data', (c: Buffer) => chunks.push(c));
    p.on('end', () => resolve(gzipSync(Buffer.concat(chunks))));
    p.on('error', reject);
    for (const [name, content] of Object.entries(files)) p.entry({ name: `./${name}` }, content);
    p.finalize();
  });
}

// Minimal in-memory env. `tree` maps env-relative path → file content. exec()
// answers the find/tar/build probes the capture helpers issue.
function makeEnv(opts: {
  tree: Record<string, string>;
  builtDir?: string | null; // what `find index.html` resolves to (null = none yet)
  pkgPath?: string | null; // what `find package.json` resolves to
  onBuild?: () => void; // mutate tree to simulate a build producing builtDir
}): { env: EnvironmentHandle; events: EngineEvent[]; io: RunIO } {
  const tree = opts.tree; // by reference — onBuild mutates this same object
  let built = opts.builtDir ?? null;
  const events: EngineEvent[] = [];
  const io: RunIO = { emit: (ev) => events.push(ev) };

  const exec = async (cmd: string): Promise<ExecResult> => {
    const ok = (stdout = ''): ExecResult => ({ exitCode: 0, stdout, stderr: '' });
    if (cmd.includes('-name index.html')) return ok(built ? built + '\n' : '');
    if (cmd.includes('-name package.json')) return ok(opts.pkgPath ? opts.pkgPath + '\n' : '');
    if (cmd.includes('npm run build') || cmd.includes('vite build')) {
      opts.onBuild?.();
      if (opts.onBuild) built = 'dist';
      return ok();
    }
    if (cmd.startsWith('tar czf')) {
      // tar czf <archive> -C <dir> .  → snapshot files under <dir> into <archive>.
      const m = cmd.match(/tar czf (\S+) -C "?([^"]+)"? \./);
      if (!m) return { exitCode: 1, stdout: '', stderr: 'bad tar cmd' };
      const [, archive, dir] = m;
      const prefix = dir.replace(/^\.\//, '').replace(/\/$/, '') + '/';
      const sub: Record<string, string> = {};
      for (const [k, v] of Object.entries(tree)) if (k.startsWith(prefix)) sub[k.slice(prefix.length)] = v;
      (tree as Record<string, Buffer>)[archive + '#bytes'] = (await tarball(sub)) as unknown as string;
      return ok();
    }
    return ok();
  };

  const readFile = async (p: string): Promise<Buffer | null> => {
    const clean = p.replace(/^\.\//, '');
    const bytesKey = clean + '#bytes';
    if ((tree as Record<string, unknown>)[bytesKey]) return (tree as Record<string, Buffer>)[bytesKey] as Buffer;
    if (clean in tree) return Buffer.from(tree[clean]);
    return null;
  };

  const env = {
    id: 'stub',
    capabilities: {} as EnvironmentHandle['capabilities'],
    exec,
    readFile,
    writeFiles: async () => {},
    exposePort: async () => ({ url: 'http://x' }),
    destroy: async () => {},
  } as unknown as EnvironmentHandle;

  return { env, events, io };
}

describe('captureStaticSnapshot', () => {
  it('tars the built dir, ingests it, and emits preview_snapshot_ready', async () => {
    const { env, events, io } = makeEnv({
      tree: { 'dist/index.html': '<!doctype html><div>app</div>', 'dist/assets/a.js': 'x' },
      builtDir: 'dist',
    });
    const res = await captureStaticSnapshot(env, io, 'dist');
    expect(res.ok).toBe(true);
    expect(res.snapshotId).toMatch(/^[a-f0-9]{24}$/);
    const ev = events.find((e) => e.type === 'preview_snapshot_ready');
    expect(ev).toBeTruthy();
  });

  it('fails cleanly when the dir has no index.html', async () => {
    const { env, io } = makeEnv({ tree: { 'dist/main.js': 'x' }, builtDir: 'dist' });
    const res = await captureStaticSnapshot(env, io, 'dist');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/index\.html/);
  });
});

describe('autoCaptureStaticSnapshot', () => {
  const log = () => {};

  it('captures an already-built dir without building', async () => {
    const { env, events } = makeEnv({
      tree: { 'dist/index.html': '<html>auto</html>' },
      builtDir: 'dist',
    });
    const ok = await autoCaptureStaticSnapshot(env, { emit: (e) => events.push(e) }, log);
    expect(ok).toBe(true);
    expect(events.some((e) => e.type === 'preview_snapshot_ready')).toBe(true);
  });

  it('builds first when no built dir exists, then captures', async () => {
    const tree: Record<string, string> = { 'app/package.json': '{}' };
    const { env, events } = makeEnv({
      tree,
      builtDir: null,
      pkgPath: './app/package.json',
      onBuild: () => {
        tree['dist/index.html'] = '<html>built</html>';
      },
    });
    const ok = await autoCaptureStaticSnapshot(env, { emit: (e) => events.push(e) }, log);
    expect(ok).toBe(true);
    expect(events.some((e) => e.type === 'preview_snapshot_ready')).toBe(true);
  });

  it('returns false (non-fatal) when nothing buildable is found', async () => {
    const { env } = makeEnv({ tree: { 'readme.txt': 'hi' }, builtDir: null, pkgPath: null });
    const ok = await autoCaptureStaticSnapshot(env, { emit: () => {} }, log);
    expect(ok).toBe(false);
  });
});
