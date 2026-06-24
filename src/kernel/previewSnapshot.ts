// src/kernel/previewSnapshot.ts
// The DURABLE preview store. A built app's STATIC output (the agent's `dist/`)
// is captured ONCE into a content-addressed directory on the kernel's disk and
// served from there — so the read-only preview survives the sandbox being torn
// down or idle-killed. This is the cheap counterpart to the live proxy URL
// (`preview_ready`): viewing a finished build no longer pins a running sandbox.
//
// Substrate-free by construction (only node fs/zlib/crypto + tar-stream), so it
// is allowed to live under src/kernel without tripping the grep gate — it never
// names a container, microVM, or SDK. The agent hands us a gzipped tarball that
// it produced INSIDE its opaque environment (`tar czf … dist`); we never learn
// where that tarball came from.

import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extract as tarExtract } from 'tar-stream';

export interface SnapshotMeta {
  snapshotId: string;
  fileCount: number;
  bytes: number;
}

export interface ResolvedFile {
  absPath: string;
  contentType: string;
}

// Caps mirror the chat-image cap doctrine elsewhere: a snapshot is a small built
// web app, not a data lake. Refuse oversized captures rather than silently
// truncating — a partial app is worse than a clear error the agent can act on.
const MAX_FILES = 1000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

function contentTypeFor(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

interface CapturedFile {
  name: string;
  content: Buffer;
}

// Parse a (already-gunzipped) tar buffer into in-memory file entries. tar-stream
// is push-based; wrap it in a Promise that resolves once the archive drains.
function untar(tar: Buffer): Promise<CapturedFile[]> {
  return new Promise((resolve, reject) => {
    const out: CapturedFile[] = [];
    const ex = tarExtract();
    ex.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.on('end', next);
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('error', reject);
      stream.on('end', () => {
        // `tar czf - -C dir .` names entries './index.html', './assets/x.js',
        // plus './' dir markers — normalize the leading './' away.
        const name = header.name.replace(/^\.\/+/, '');
        if (name) out.push({ name, content: Buffer.concat(chunks) });
        next();
      });
    });
    ex.on('finish', () => resolve(out));
    ex.on('error', reject);
    Readable.from(tar).pipe(ex);
  });
}

// Content-addressed id: identical builds dedupe to the same dir for free (the
// 21st bundle-hash trick). Hash sorted name+bytes so order can't shift the id.
function hashFiles(files: CapturedFile[]): string {
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    h.update(f.name);
    h.update('\0');
    h.update(f.content);
    h.update('\0');
  }
  return h.digest('hex').slice(0, 24);
}

export class PreviewSnapshotStore {
  constructor(private readonly root: string) {}

  // Ingest a gzipped tarball produced inside the env. Extract → enforce caps →
  // write into root/<snapshotId>/ (idempotent: content-addressed). Returns the
  // metadata the tool surfaces in `preview_snapshot_ready`.
  async ingestTarball(tgz: Buffer): Promise<SnapshotMeta> {
    let files: CapturedFile[];
    try {
      files = await untar(gunzipSync(tgz));
    } catch (err) {
      throw new Error(`could not read snapshot archive: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!files.length) throw new Error('snapshot archive contained no files');
    if (files.length > MAX_FILES) throw new Error(`snapshot has ${files.length} files (cap ${MAX_FILES})`);

    let total = 0;
    for (const f of files) {
      if (f.content.length > MAX_FILE_BYTES) {
        throw new Error(`file ${f.name} is ${f.content.length} bytes (per-file cap ${MAX_FILE_BYTES})`);
      }
      total += f.content.length;
    }
    if (total > MAX_TOTAL_BYTES) throw new Error(`snapshot is ${total} bytes (cap ${MAX_TOTAL_BYTES})`);
    if (!files.some((f) => f.name === 'index.html' || f.name.endsWith('/index.html'))) {
      throw new Error('snapshot has no index.html — point snapshot_preview at the built static dir');
    }

    const snapshotId = hashFiles(files);
    const dir = path.join(this.root, snapshotId);
    for (const f of files) {
      // Drop any traversal in archived names before joining (defense in depth;
      // a malicious '../' entry must never escape the snapshot dir).
      const safe = path.normalize(f.name).replace(/^(\.\.(\/|\\|$))+/, '');
      const dest = path.join(dir, safe);
      if (!dest.startsWith(dir + path.sep)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content);
    }
    return { snapshotId, fileCount: files.length, bytes: total };
  }

  // Resolve a request path within a snapshot to an on-disk file. Path-traversal
  // safe; a directory (or '') resolves to its index.html (SPA root). Returns
  // null when the snapshot or file is absent.
  resolve(snapshotId: string, relPath: string): ResolvedFile | null {
    if (!/^[a-f0-9]{8,64}$/.test(snapshotId)) return null;
    const base = path.join(this.root, snapshotId);
    const clean = (relPath || '').replace(/^\/+/, '');
    let abs = path.normalize(path.join(base, clean));
    if (abs !== base && !abs.startsWith(base + path.sep)) return null;
    try {
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        abs = path.join(abs, 'index.html');
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    } catch {
      return null;
    }
    return { absPath: abs, contentType: contentTypeFor(abs) };
  }
}

// Process-level singleton, consistent with how the tool seam already reaches
// ambient config (websearch reads process.env directly). Root is overridable via
// PREVIEW_SNAPSHOT_DIR so a deploy can point it at a mounted volume; defaults to
// a tmp dir (cleared on reboot — acceptable for the in-memory session→snapshot
// map, which is also process-lived until persistence lands).
let singleton: PreviewSnapshotStore | null = null;
export function previewSnapshotStore(): PreviewSnapshotStore {
  if (!singleton) {
    const root = process.env.PREVIEW_SNAPSHOT_DIR || path.join(os.tmpdir(), 'kernel-preview-snapshots');
    fs.mkdirSync(root, { recursive: true });
    singleton = new PreviewSnapshotStore(root);
  }
  return singleton;
}
