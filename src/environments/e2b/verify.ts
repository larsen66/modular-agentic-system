// src/environments/e2b/verify.ts
// Self-skipping acceptance probe for the E2B environment adapter.
//
// Run:   npx tsx src/environments/e2b/verify.ts
//
// REAL path (no mocks): provisions a real E2B sandbox, writes a tiny static
// site, serves it with a real dev server, exposes the port, and asserts the
// returned public URL serves HTTP 200 with our marker HTML. Then tears the
// sandbox down.
//
// BLOCKER: needs E2B_API_KEY (and an E2B account). With no key the script SKIPs
// cleanly (exit 0) — it NEVER mocks the sandbox as the deliverable. Set the key
// and the SAME code goes fully live with zero changes.

import { resolveEnvironment } from '../../registry/index.js';
import { isProcessHandle } from '../../types/index.js';
import { applyHarnessEnv } from '../../server/harnessEnv.js';
import './index.js'; // self-register the 'e2b' adapter

const PORT = 8000;
const MARKER = `e2b-verify-${Date.now()}`;

function httpGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 10_000
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    fetch(url, { headers, signal: ac.signal })
      .then(async (res) => {
        const body = await res.text();
        clearTimeout(timer);
        resolve({ status: res.status, body });
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function main(): Promise<void> {
  applyHarnessEnv();

  if (!process.env.E2B_API_KEY) {
    console.log('[verify:e2b] SKIP — E2B_API_KEY not set (expected blocker).');
    console.log('[verify:e2b] The real path is implemented; set E2B_API_KEY to run it live.');
    process.exit(0);
  }

  console.log('[verify:e2b] E2B_API_KEY present — running REAL sandbox verification.');
  const env = resolveEnvironment('e2b');
  const log = (level: string, message: string) => console.log(`  [${level}] ${message}`);

  const handle = await env.provision({
    source: {
      kind: 'files',
      files: [
        // A static index.html the dev server will serve at '/'.
        { path: 'index.html', content: `<!doctype html><title>${MARKER}</title><h1>${MARKER}</h1>` },
      ],
    },
    logger: log as never,
  });

  let dev: Awaited<ReturnType<typeof handle.exec>> | undefined;
  try {
    // Serve the static dir on PORT with a dependency-free dev server (node ships
    // in the E2B base template, so `node --version` / a tiny http server "just
    // works" without npm install).
    dev = await handle.exec(`python3 -m http.server ${PORT}`, { detached: true });
    if (!isProcessHandle(dev)) {
      throw new Error('detached exec did not return a ProcessHandle');
    }
    console.log(`[verify:e2b] dev server started (pid=${dev.pid ?? '?'})`);

    if (handle.waitForPort) await handle.waitForPort(PORT, 30_000);

    const { url, token } = await handle.exposePort(PORT);
    console.log(`[verify:e2b] exposed → ${url} (token=${token ? 'present' : 'none'})`);

    // Private sandbox → attach the traffic access token header the adapter handed back.
    const headers: Record<string, string> = token ? { 'e2b-traffic-access-token': token } : {};
    let res: { status: number; body: string } | undefined;
    for (let i = 0; i < 10; i++) {
      try {
        res = await httpGet(url, headers);
        if (res.status === 200) break;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!res || res.status !== 200) {
      throw new Error(`preview did not serve HTTP 200 (got ${res?.status ?? 'no response'})`);
    }
    if (!res.body.includes(MARKER)) {
      throw new Error('preview served 200 but body missing marker — wrong upstream');
    }

    console.log(`[verify:e2b] PASS ✅ — preview served HTTP 200 with marker (${MARKER}).`);
  } finally {
    if (dev && isProcessHandle(dev)) await dev.kill().catch(() => {});
    await handle.destroy().catch(() => {});
    console.log('[verify:e2b] sandbox torn down.');
  }
}

main().catch((err) => {
  console.error('[verify:e2b] FAIL ❌');
  console.error(err);
  process.exit(1);
});
