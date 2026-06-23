// src/environments/codesandbox/verify.ts
// Self-skipping acceptance probe for the REAL CodeSandbox environment adapter.
//
//   npx tsx src/environments/codesandbox/verify.ts
//
// REAL path — no mock substituted. It provisions a real CodeSandbox sandbox,
// writes a one-file static app, starts a real dev server in a background
// command, exposes the port (minting a host token), and asserts the preview URL
// serves HTTP 200 with our marker HTML. Tears the sandbox down at the end.
//
// BLOCKER: CSB_API_KEY. Without it this script SKIPs (exit 0) with a clear
// message — it never silently passes a mock. Get a key at
// https://codesandbox.io/t/api and: export CSB_API_KEY=csb_... before running.
//
// Exit codes: 0 = PASS or SKIP (no key); 1 = FAIL (key present but path broke).

import { CsbEnvironment } from './index.js';
import type { EnvironmentHandle, EnvLogger, ProcessHandle } from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';
import { applyHarnessEnv } from '../../server/harnessEnv.js';

const PREVIEW_PORT = 8080;

const MARKER = `csb-verify-${Date.now()}`;
const INDEX_HTML = `<!doctype html><html><head><title>csb verify</title></head><body><div id="root">${MARKER}</div></body></html>`;

const log: EnvLogger = (level, msg) => console.log(`  [${level}] ${msg}`);

function skip(reason: string): never {
  console.log(`\n[verify:codesandbox] SKIP ⏭  ${reason}`);
  console.log('[verify:codesandbox] (no silent mock — set CSB_API_KEY to run the real path.)');
  process.exit(0);
}

async function fetchPreview(
  url: string,
  token: string | undefined,
  attempts = 20
): Promise<{ status: number; body: string } | null> {
  // Private sandboxes require the host token as a header (csb-preview-token).
  const headers: Record<string, string> = {};
  if (token) headers['csb-preview-token'] = token;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers });
      const body = await res.text();
      if (res.status === 200) return { status: res.status, body };
    } catch {
      /* dev server may not be up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function main() {
  applyHarnessEnv();

  if (!process.env.CSB_API_KEY) {
    skip('CSB_API_KEY is not set.');
  }

  const env = new CsbEnvironment();
  let handle: EnvironmentHandle | undefined;
  let devProc: ProcessHandle | undefined;

  try {
    console.log('\n[verify:codesandbox] provisioning real sandbox…');
    handle = await env.provision({
      source: { kind: 'files', files: [{ path: 'public/index.html', content: INDEX_HTML }] },
      logger: log,
    });

    console.log('[verify:codesandbox] starting dev server (background command)…');
    // `npx serve` is available on the universal template; serves the `public/`
    // dir statically. A `-l` flag sets the port.
    const started = await handle.exec(`npx --yes serve -l ${PREVIEW_PORT} public`, {
      detached: true,
    });
    if (!isProcessHandle(started)) {
      throw new Error('detached exec did not return a ProcessHandle');
    }
    devProc = started;

    console.log('[verify:codesandbox] waiting for port…');
    await handle.waitForPort?.(PREVIEW_PORT, 90_000);

    console.log('[verify:codesandbox] exposing preview port (host token)…');
    const { url, token } = await handle.exposePort(PREVIEW_PORT);
    console.log(`  ★ preview URL: ${url}`);

    const got = await fetchPreview(url, token);
    const appLooksReal = !!got && got.body.includes(MARKER);

    console.log('\n================= verify:codesandbox =================');
    console.log(`sandbox provisioned:           YES ✓ ${handle.id}`);
    console.log(`detached dev server (handle):  ${devProc ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview URL returned:          ${url ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview served HTTP 200:       ${got ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview HTML is our app:       ${appLooksReal ? 'YES ✓' : 'NO ✗'}`);
    console.log('======================================================');

    const pass = !!url && !!got && appLooksReal;
    console.log(
      pass
        ? '\n[verify:codesandbox] PASS ✅  (real sandbox × real fs × real host-token preview)'
        : '\n[verify:codesandbox] FAIL ❌'
    );
    process.exitCode = pass ? 0 : 1;
  } catch (e) {
    console.error('\n[verify:codesandbox] FAIL ❌', e);
    process.exitCode = 1;
  } finally {
    await devProc?.kill().catch(() => {});
    await handle?.destroy().catch(() => {});
  }
}

main();
