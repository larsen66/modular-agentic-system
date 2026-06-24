import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pack as tarPack } from 'tar-stream';
import { PreviewSnapshotStore } from '../src/kernel/previewSnapshot.js';

// Build a gzipped tarball the same shape `tar czf - -C dir .` produces inside an
// env: entries prefixed with './', including binary assets and a nested dir.
function makeTarball(files: { name: string; content: Buffer | string }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = tarPack();
    const chunks: Buffer[] = [];
    p.on('data', (c: Buffer) => chunks.push(c));
    p.on('end', () => resolve(gzipSync(Buffer.concat(chunks))));
    p.on('error', reject);
    for (const f of files) {
      p.entry({ name: `./${f.name}` }, Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content));
    }
    p.finalize();
  });
}

let root: string;
let store: PreviewSnapshotStore;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-test-'));
  store = new PreviewSnapshotStore(root);
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('PreviewSnapshotStore', () => {
  it('ingests a tarball, resolves files, and falls back to index.html at the root', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic
    const tgz = await makeTarball([
      { name: 'index.html', content: '<!doctype html><script src="./assets/app.js"></script>' },
      { name: 'assets/app.js', content: 'console.log("hi")' },
      { name: 'favicon.png', content: png },
    ]);

    const meta = await store.ingestTarball(tgz);
    expect(meta.fileCount).toBe(3);
    expect(meta.bytes).toBeGreaterThan(0);
    expect(meta.snapshotId).toMatch(/^[a-f0-9]{24}$/);

    // '' resolves to index.html (SPA root), with the right content type.
    const rootFile = store.resolve(meta.snapshotId, '');
    expect(rootFile).not.toBeNull();
    expect(rootFile!.contentType).toContain('text/html');
    expect(fs.readFileSync(rootFile!.absPath, 'utf8')).toContain('app.js');

    // Nested asset resolves with a js content type.
    const asset = store.resolve(meta.snapshotId, 'assets/app.js');
    expect(asset).not.toBeNull();
    expect(asset!.contentType).toContain('javascript');

    // Binary asset round-trips byte-for-byte (proves the readFile/tar path is
    // binary-safe, unlike exec-stdout capture would be).
    const icon = store.resolve(meta.snapshotId, 'favicon.png');
    expect(icon).not.toBeNull();
    expect(fs.readFileSync(icon!.absPath)).toEqual(png);
  });

  it('is content-addressed: identical builds dedupe to the same snapshot id', async () => {
    const files = [{ name: 'index.html', content: '<html>same</html>' }];
    const a = await store.ingestTarball(await makeTarball(files));
    const b = await store.ingestTarball(await makeTarball(files));
    expect(a.snapshotId).toBe(b.snapshotId);
  });

  it('refuses a snapshot with no index.html', async () => {
    const tgz = await makeTarball([{ name: 'main.js', content: 'x' }]);
    await expect(store.ingestTarball(tgz)).rejects.toThrow(/index\.html/);
  });

  it('guards against path traversal in resolve()', async () => {
    const tgz = await makeTarball([{ name: 'index.html', content: '<html></html>' }]);
    const meta = await store.ingestTarball(tgz);
    expect(store.resolve(meta.snapshotId, '../../etc/passwd')).toBeNull();
    expect(store.resolve('not-a-valid-id!', 'index.html')).toBeNull();
    expect(store.resolve(meta.snapshotId, 'missing.js')).toBeNull();
  });
});
