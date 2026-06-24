// src/harnesses/pi/snapshotTool.ts
// The `snapshot_preview` tool for PI (both topologies). PI's bash runs INSIDE the
// opaque EnvironmentHandle, so the build output it produces (e.g. `dist/`) lives
// in the env. This tars that dir, reads the archive back via the contract's
// readFile (binary-safe — exec stdout would corrupt bytes), and hands it to the
// kernel's content-addressed snapshot store. It emits the `preview_snapshot_ready`
// EngineEvent the orchestrator pump maps onto the session, so the durable static
// preview survives sandbox teardown — the cheap read-only counterpart to
// expose_port's live proxy URL.
//
// The capture itself is extracted into `captureStaticSnapshot()` so the harness
// can ALSO run it automatically at end-of-run (auto-capture safety net) without
// the model having to call the tool — see `autoCaptureStaticSnapshot()`.
//
// Loosely typed (`any`) for the same reason exposeTool.ts is:
// @mariozechner/pi-coding-agent is a dynamically-imported optional dep, so
// defineTool / TypeBox `Type` arrive at runtime.

import { previewSnapshotStore } from '../../kernel/previewSnapshot.js';
import { isProcessHandle } from '../../types/index.js';
import type { EnvironmentHandle, RunIO } from '../../types/index.js';

export interface CaptureResult {
  ok: boolean;
  message: string;
  snapshotId?: string;
}

// Tar the built static dir INSIDE the env, read it back binary-safe, ingest into
// the content-addressed store, and emit preview_snapshot_ready. Shared by the
// `snapshot_preview` tool and the harness auto-capture. Never throws — returns a
// CaptureResult the caller surfaces (tool content / log line).
export async function captureStaticSnapshot(
  env: EnvironmentHandle,
  io: RunIO,
  dirRaw: string,
): Promise<CaptureResult> {
  const dir = (String(dirRaw ?? 'dist').trim() || 'dist').replace(/\/+$/, '');
  const idx = await env.readFile(`${dir}/index.html`);
  if (!idx) {
    return {
      ok: false,
      message:
        `No ${dir}/index.html found. Produce a static build first (e.g. \`npx vite build --base ./\`) ` +
        `so ${dir}/index.html exists, then snapshot again.`,
    };
  }
  const archive = '/tmp/__kernel_snapshot.tgz';
  const r = await env.exec(`tar czf ${archive} -C ${JSON.stringify(dir)} .`, { timeoutMs: 120_000 });
  if (isProcessHandle(r) || r.exitCode !== 0) {
    const detail = isProcessHandle(r)
      ? 'tar ran in background'
      : `tar exited ${r.exitCode}: ${(r.stderr || r.stdout).slice(-800)}`;
    return { ok: false, message: `snapshot failed: ${detail}` };
  }
  const tgz = await env.readFile(archive);
  if (!tgz) {
    return { ok: false, message: `snapshot failed: could not read archive at ${archive}` };
  }
  try {
    const meta = await previewSnapshotStore().ingestTarball(tgz);
    // Metadata-only event (bytes already on the kernel's disk); the pump maps
    // snapshotId onto the session — the same pump that routes preview_ready.
    io.emit({ type: 'preview_snapshot_ready', snapshotId: meta.snapshotId, fileCount: meta.fileCount, bytes: meta.bytes });
    return {
      ok: true,
      snapshotId: meta.snapshotId,
      message:
        `Durable preview snapshot stored: ${meta.fileCount} files, ${meta.bytes} bytes. ` +
        `It is served as the preview even after this sandbox is gone.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `snapshot failed: ${message}` };
  }
}

// Best-effort AUTO capture for end-of-run: find an already-built static dir; if
// none, try to build the detected app; then capture it. Used by the harness when
// a live preview was exposed but the model never called snapshot_preview — so a
// durable copy always exists and "reopen the chat → see the app" works even after
// the sandbox dies. Non-fatal: any failure just logs and leaves live-only behaviour.
export async function autoCaptureStaticSnapshot(
  env: EnvironmentHandle,
  io: RunIO,
  log: (level: 'info' | 'warn', message: string) => void,
): Promise<boolean> {
  // 1. Locate an existing build dir (index.html under a conventional output dir).
  let dir = await findBuiltDir(env);
  // 2. If none, try to build the app, then re-scan.
  if (!dir) {
    log('info', 'auto-snapshot: no built dir found, attempting a production build');
    await tryBuild(env, log);
    dir = await findBuiltDir(env);
  }
  if (!dir) {
    log('warn', 'auto-snapshot: no static build dir found; preview stays live-only');
    return false;
  }
  log('info', `auto-snapshot: capturing ${dir}`);
  const res = await captureStaticSnapshot(env, io, dir);
  if (!res.ok) log('warn', `auto-snapshot: ${res.message}`);
  else log('info', `auto-snapshot: ${res.message}`);
  return res.ok;
}

// Find the first conventional build-output dir that contains index.html, skipping
// node_modules. Returns an env-relative path or null. Uses a single exec.
async function findBuiltDir(env: EnvironmentHandle): Promise<string | null> {
  // find index.html up to depth 4, keep only those under a known output dir name.
  const script =
    `find . -maxdepth 5 -type f -name index.html -not -path '*/node_modules/*' 2>/dev/null ` +
    `| while read f; do d=$(dirname "$f"); ` +
    `case "$d" in */dist|*/build|*/out|*/.output/public|./dist|./build|./out) echo "$d";; esac; done | head -1`;
  const r = await env.exec(script, { timeoutMs: 30_000 });
  if (isProcessHandle(r) || r.exitCode !== 0) return null;
  const out = (r.stdout || '').trim().split('\n')[0]?.trim();
  if (!out) return null;
  // normalize leading ./
  return out.replace(/^\.\//, '') || null;
}

// Best-effort build: find the primary app dir (shallowest package.json outside
// node_modules) and build it. Prefer a relative-base Vite build (assets resolve
// under the /app/ sub-path); fall back to `npm run build`. Bounded + non-fatal.
async function tryBuild(env: EnvironmentHandle, log: (l: 'info' | 'warn', m: string) => void): Promise<void> {
  const findPkg =
    `find . -maxdepth 3 -name package.json -not -path '*/node_modules/*' 2>/dev/null ` +
    `| awk '{print length, $0}' | sort -n | head -1 | cut -d' ' -f2-`;
  const pr = await env.exec(findPkg, { timeoutMs: 30_000 });
  if (isProcessHandle(pr) || pr.exitCode !== 0) return;
  const pkgPath = (pr.stdout || '').trim().split('\n')[0]?.trim();
  if (!pkgPath) return;
  const appDir = pkgPath.replace(/\/package\.json$/, '').replace(/^\.\//, '') || '.';
  // Vite gets an explicit relative base so the snapshot serves under /app/. Other
  // toolchains use their own build script (base handling is their concern).
  const build =
    `cd ${JSON.stringify(appDir)} && (npm run build -- --base ./ 2>/dev/null || npx vite build --base ./ 2>/dev/null || npm run build)`;
  const br = await env.exec(build, { timeoutMs: 240_000 });
  if (isProcessHandle(br)) {
    log('warn', 'auto-snapshot: build ran in background; skipping');
    return;
  }
  if (br.exitCode !== 0) {
    log('warn', `auto-snapshot: build exited ${br.exitCode}: ${(br.stderr || br.stdout).slice(-300)}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSnapshotPreviewToolDefinition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defineTool: (def: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Type: any,
  env: EnvironmentHandle,
  io: RunIO,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return defineTool({
    name: 'snapshot_preview',
    label: 'Capture a durable preview snapshot',
    description:
      'Capture the STATIC build output of your app into a DURABLE preview that keeps working even after the ' +
      'sandbox is gone. Call this AFTER producing a production build of static files (e.g. `npm run build` → ' +
      '`dist/`). IMPORTANT: build with a RELATIVE asset base so assets resolve under the preview sub-path — ' +
      'for Vite run `npx vite build --base ./`. Pass the directory containing the built index.html (default ' +
      '"dist"). Optional durability step — do it after the live preview already works.',
    promptSnippet: 'snapshot_preview — freeze the built static app into a durable preview that outlives the sandbox.',
    parameters: Type.Object({
      dir: Type.Optional(
        Type.String({ description: 'Directory of built static files containing index.html. Default "dist".' })
      ),
    }),
    async execute(_toolCallId: string, params: { dir?: string }) {
      const res = await captureStaticSnapshot(env, io, params.dir ?? 'dist');
      return { content: [{ type: 'text', text: res.message }], isError: !res.ok };
    },
  });
}
