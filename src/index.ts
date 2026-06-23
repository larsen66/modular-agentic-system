// src/index.ts — entrypoint. Self-register all adapters, then start the server.

import './server/wsPolyfill.js'; // MUST precede any supabase createClient (Node <22 lacks global WebSocket).
import './server/loadEnv.js'; // MUST be first — populate .env before env reads.
import { Kernel } from './kernel/index.js';
import { buildServer } from './server/http.js';
import { loadOptionalAdapters } from './server/bootstrap.js';
import { applyHarnessEnv } from './server/harnessEnv.js';

const PORT = Number(process.env.PORT ?? 3000);
// Bind address. Defaults to 0.0.0.0 (local dev convenience). In a shared/public
// deploy set HOST=127.0.0.1 so the DEV_NO_AUTH write path isn't world-reachable.
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  applyHarnessEnv();
  await loadOptionalAdapters();

  const kernel = new Kernel();
  const app = buildServer(kernel);

  await app.listen({ port: PORT, host: HOST });
  // eslint-disable-next-line no-console
  console.log(`[modular-runner] listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  harnesses:    ${kernel.listHarnesses().join(', ')}`);
  // eslint-disable-next-line no-console
  console.log(`  environments: ${kernel.listEnvironments().join(', ')}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
