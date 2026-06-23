// scripts/e2e-pi-default.ts — proves the WIRED default path: a run with NO explicit
// harness resolves to the PI profile (harness=pi, env=local, agent-as-tool) and
// completes through the real Kernel (admission → session → orchestrator →
// resolveTopology). Run: npx tsx scripts/e2e-pi-default.ts  (needs OPENROUTER_API_KEY)

import { loadOptionalAdapters } from '../src/server/bootstrap.js';
import { Kernel } from '../src/kernel/index.js';
import { PI_MAIN_PROFILE } from '../src/profiles/pi.js';
import type { EngineEvent } from '../src/types/index.js';

await loadOptionalAdapters(); // bootstrap also eagerly registers pi + local

const kernel = new Kernel();
console.log('harnesses:', kernel.listHarnesses().join(', '));

// Simulate exactly what http.ts now builds when `harness` is omitted from the body.
const config = {
  sessionId: 'e2e-pi-default',
  harness: PI_MAIN_PROFILE.harness, // 'pi'
  environment: PI_MAIN_PROFILE.environment, // 'local'
  model: PI_MAIN_PROFILE.model, // exactly what http.ts injects on the no-harness path
  toolRefs: PI_MAIN_PROFILE.toolRefs,
  skillRefs: PI_MAIN_PROFILE.skillRefs,
  topology: undefined, // pass-through → kernel picks pi's default (agent-as-tool)
  source: { kind: 'files' as const, files: [] },
};

let resolvedTopology = '?';
let wroteOk = false;
let terminal: { cause: string; error?: unknown } | undefined;

const handle = kernel.runMessage(config, 'Create a file named e2e.txt with content WIRED_OK. Then stop.', (ev: EngineEvent) => {
  if (ev.type === 'log' && ev.message.includes('topology:')) resolvedTopology = ev.message.split('topology:')[1]!.trim();
  if (ev.type === 'tool_call') console.log(`  · tool_call: ${ev.name}`);
  if (ev.type === 'tool_result' && ev.ok) wroteOk = true;
  if (ev.type === 'terminal') terminal = { cause: ev.cause, error: ev.error };
});

const result = await handle.result;
await kernel.endSession(config.sessionId);

console.log(`\nresolved harness: ${config.harness} · topology: ${resolvedTopology}`);
console.log(`terminal: ${JSON.stringify(terminal)} · settled cause: ${result.cause}`);

if (result.cause === 'done' && resolvedTopology === 'agent-as-tool' && wroteOk) {
  console.log('\n✅ PASS — no-harness run defaulted to pi/agent-as-tool and completed with a successful tool call.');
  process.exit(0);
}
console.log('\n❌ FAIL — see above.');
process.exit(1);
