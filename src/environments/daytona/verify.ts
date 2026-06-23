// src/environments/daytona/verify.ts
// Self-skipping acceptance probe for the REAL Daytona environment adapter.
//
//   npx tsx src/environments/daytona/verify.ts
//
// REAL path — no mock substituted. It provisions a real Daytona cloud sandbox,
// writes a real one-file Vite/static app, starts a real dev server in a real
// background session, calls the native getPreviewLink, and asserts the preview
// URL serves HTTP 200 with the app's HTML. Tears the sandbox down at the end.
//
// BLOCKER: DAYTONA_API_KEY. Without it this script SKIPs (exit 0) with a clear
// message — it never silently passes a mock. Get a key at https://app.daytona.io
// ($200 free credits) and:  export DAYTONA_API_KEY=dtn_...  before running.
//
// Exit codes: 0 = PASS or SKIP (no key); 1 = FAIL (key present but path broke).

import { DaytonaEnvironment } from './index.js';
import type { EnvironmentHandle, EnvLogger, ProcessHandle } from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';
import { applyHarnessEnv } from '../../server/harnessEnv.js';

const PREVIEW_PORT = 4173;

// A minimal static app served by `npx serve` — keeps the dev-server step fast
// and dependency-light (one npm package) while still exercising a real port +
// real preview proxy. A unique marker proves WE are what the preview serves.
const MARKER = `daytona-verify-${Date.now()}`;
const INDEX_HTML = `<!doctype html><html><head><title>daytona verify</title></head><body><div id="root">${MARKER}</div></body></html>`;

const log: EnvLogger = (level, msg) => console.log(`  [${level}] ${msg}`);

function skip(reason: string): never {
  console.log(`\n[verify:daytona] SKIP ⏭  ${reason}`);
  console.log('[verify:daytona] (no silent mock — set DAYTONA_API_KEY to run the real path.)');
  process.exit(0);
}

async function fetchPreview(
  url: string,
  token: string | undefined,
  attempts = 20
): Promise<{ status: number; body: string } | null> {
  // Private sandboxes require the preview token header; the skip-warning header
  // avoids the first-hit interstitial page. Both are documented in §3.
  const headers: Record<string, string> = { 'X-Daytona-Skip-Preview-Warning': 'true' };
  if (token) headers['x-daytona-preview-token'] = token;
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

  if (!process.env.DAYTONA_API_KEY) {
    skip('DAYTONA_API_KEY is not set.');
  }

  const env = new DaytonaEnvironment();
  let handle: EnvironmentHandle | undefined;
  let devProc: ProcessHandle | undefined;

  try {
    console.log('\n[verify:daytona] provisioning real sandbox…');
    handle = await env.provision({
      source: { kind: 'files', files: [{ path: 'public/index.html', content: INDEX_HTML }] },
      logger: log,
    });

    console.log('[verify:daytona] starting dev server (background session)…');
    const started = await handle.exec(`npx --yes serve -l ${PREVIEW_PORT} public`, {
      detached: true,
    });
    if (!isProcessHandle(started)) {
      throw new Error('detached exec did not return a ProcessHandle');
    }
    devProc = started;

    console.log('[verify:daytona] waiting for port…');
    await handle.waitForPort?.(PREVIEW_PORT, 90_000);

    console.log('[verify:daytona] exposing preview port (native getPreviewLink)…');
    const { url, token } = await handle.exposePort(PREVIEW_PORT);
    console.log(`  ★ preview URL: ${url}`);

    const got = await fetchPreview(url, token);
    const appLooksReal = !!got && got.body.includes(MARKER);

    console.log('\n==================== verify:daytona ====================');
    console.log(`sandbox provisioned:           YES ✓ ${handle.id}`);
    console.log(`detached dev server (handle):  ${devProc ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview URL returned:          ${url ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview served HTTP 200:       ${got ? 'YES ✓' : 'NO ✗'}`);
    console.log(`preview HTML is our app:       ${appLooksReal ? 'YES ✓' : 'NO ✗'}`);
    console.log('========================================================');

    const pass = !!url && !!got && appLooksReal;
    console.log(
      pass
        ? '\n[verify:daytona] PASS ✅  (real sandbox × native git/fs × real getPreviewLink preview)'
        : '\n[verify:daytona] FAIL ❌'
    );
    process.exitCode = pass ? 0 : 1;
  } catch (e) {
    console.error('\n[verify:daytona] FAIL ❌', e);
    process.exitCode = 1;
  } finally {
    await devProc?.kill().catch(() => {});
    await handle?.destroy().catch(() => {});
  }
}

main();
