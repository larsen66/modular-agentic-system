// scripts/verify-cli.ts
// PROOF script for the CLI-credential harness (hermes-cli / claude-cli /
// codex-cli × local).
// Runs the REAL kernel in-process: the chosen CLI generates an app into a host
// temp workspace using the harness-selected auth path, the local env installs
// deps + starts the dev server, exposePort yields a URL, and we fetch it to
// confirm a live preview. Then we tear the workspace down (no server is left
// running — this matches the "code only, don't leave servers" constraint).
//
// Usage: tsx scripts/verify-cli.ts [hermes-cli|claude-cli|codex-cli]
// Default: hermes-cli when configured, else claude-cli.

import { Kernel } from '../src/kernel/index.js';
import type { EngineEvent } from '../src/types/index.js';
import '../src/environments/local/index.js';
import '../src/harnesses/cli/hermes.js';
import '../src/harnesses/cli/claude.js';
import '../src/harnesses/cli/codex.js';
import { recommendDefaults } from '../src/harnesses/cli/defaults.js';
import { applyHarnessEnv } from '../src/server/harnessEnv.js';

async function main() {
  applyHarnessEnv();
  const defaults = recommendDefaults();
  const harness = process.argv[2] ?? (defaults.harness.endsWith('-cli') ? defaults.harness : 'claude-cli');
  const kernel = new Kernel();
  console.log('harnesses:   ', kernel.listHarnesses().join(', '));
  console.log('environments:', kernel.listEnvironments().join(', '));
  console.log('recommended default:', JSON.stringify(defaults));
  console.log(`\n=== combo: harness=${harness} × environment=local ===\n`);

  let previewUrl: string | null = null;
  const order: string[] = [];

  const handle = kernel.runMessage(
    {
      sessionId: `verify-${harness}`,
      harness,
      environment: 'local',
      source: { kind: 'files', files: [] },
    },
    'Build a minimal todo app where I can add, toggle and remove items.',
    (ev: EngineEvent) => {
      order.push(ev.type);
      if (ev.type === 'log') console.log(`  [log:${ev.category}/${ev.level}] ${ev.message}`);
      else if (ev.type === 'preview_ready') {
        previewUrl = ev.url;
        console.log(`  [preview_ready] ${ev.url} (port ${ev.port})`);
      } else if (ev.type === 'tool_call') console.log(`  [tool_call] ${ev.name}`);
      else if (ev.type === 'final_text') console.log(`  [final_text] ${ev.text}`);
      else if (ev.type === 'terminal')
        console.log(`  [terminal] ${ev.cause}${ev.error ? ' ' + JSON.stringify(ev.error) : ''}`);
    }
  );

  const result = await handle.result;
  console.log('\n  -- settlement --');
  console.log('  ' + JSON.stringify(result));

  // Curl the preview to PROVE it serves real HTML.
  if (previewUrl) {
    const res = await fetch(previewUrl).catch((e) => {
      console.error('  preview fetch failed:', e?.message);
      return null;
    });
    if (res) {
      const html = await res.text();
      const okMarker = html.includes('<div id="root"') || html.toLowerCase().includes('<!doctype');
      console.log(`\n  preview HTTP ${res.status}, ${html.length} bytes, looksLikeApp=${okMarker}`);
      console.log('  first 160 bytes:', JSON.stringify(html.slice(0, 160)));
    }
  } else {
    console.log('\n  NO preview URL produced.');
  }

  // Tear down the session workspace (kills the detached dev server, removes dir).
  await kernel.endSession(`verify-${harness}`);
  console.log('\n  session torn down (dev server killed, temp workspace removed)');
  console.log(`  event order: [${order.join(', ')}]`);
  process.exit(result.cause === 'done' && previewUrl ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
