// scripts/build-e2b-template.ts
// Builds a custom E2B template with the `opencode` binary BAKED IN, so the
// opencode harness (which runs `opencode serve --pure` INSIDE the sandbox) finds
// the binary on PATH. The default E2B `base` template ships node but NOT opencode,
// so opencode×e2b runs hang forever on the port probe (the serve never starts).
// See the root-cause note: harness assumes opencode is preinstalled in the env —
// true for `local` (host), false for cloud sandboxes.
//
// e2b SDK v2 (^2.30.5) uses the PROGRAMMATIC Template builder, not e2b.toml/Dockerfile.
//
// RUN (needs YOUR E2B auth — publishes to your e2b org):
//   E2B_API_KEY=... npx tsx scripts/build-e2b-template.ts
//   # or: e2b auth login   (then)   npx tsx scripts/build-e2b-template.ts
//
// Then run opencode×e2b with runtimeProfile === TEMPLATE_NAME (or set
// OPENCODE_E2B_TEMPLATE in .harness.env — already added).

import { Template, defaultBuildLogger } from 'e2b';

// Keep in lockstep with the locally-verified version (and @opencode-ai/sdk in
// package.json) so the in-sandbox server matches the SDK client driving it.
const OPENCODE_VERSION = '1.17.9';
const TEMPLATE_NAME = 'opencode-base';

const template = Template()
  .fromBaseImage() // E2B base (has node + npm)
  .npmInstall(`opencode-ai@${OPENCODE_VERSION}`, { g: true }); // → `opencode` on PATH

if (!process.env.E2B_API_KEY) {
  // Template.build authenticates with E2B_API_KEY (or a prior `e2b auth login`).
  // Fail loud rather than letting the SDK throw an opaque 401. (The builder chain
  // above has already run — a wrong API would have thrown before this guard.)
  console.error('E2B_API_KEY is not set. Run `e2b auth login` or pass E2B_API_KEY=...');
  process.exit(1);
}

const info = await Template.build(template, TEMPLATE_NAME, {
  onBuildLogs: defaultBuildLogger(),
});

console.log(`\n✅ built E2B template "${TEMPLATE_NAME}" (opencode ${OPENCODE_VERSION})`);
console.log(info);
console.log(`\nUse it: pass runtimeProfile: "${TEMPLATE_NAME}" for opencode×e2b runs.`);
