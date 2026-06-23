// scripts/smoke-pi-aat.ts — proves PI agent-as-tool routes tools INTO the env.
// Run: npx tsx scripts/smoke-pi-aat.ts   (needs OPENROUTER_API_KEY)
//
// Proof: PI's scratch tmpDir and the env's workspace root are DIFFERENT host
// dirs. We assert the file the agent creates appears via env.readFile() — i.e.
// the env-routed write tool was used, not pi's built-in local write (which would
// land in the scratch dir). File in env => custom env-routed tools replaced built-ins.

import '../src/harnesses/pi/index.js';
import '../src/environments/local/index.js';
import { resolveEnvironment, resolveHarness } from '../src/registry/index.js';
import type { EngineEvent } from '../src/types/index.js';

const MARKER = 'HELLO_PI_AGENT_AS_TOOL';
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 120_000);

const env = await resolveEnvironment('local').provision({ source: { kind: 'files', files: [] } });
const harness = resolveHarness('pi');

let terminal: { cause: string; error?: unknown } | undefined;
let finalText = '';
const io = {
  emit: (ev: EngineEvent) => {
    if (ev.type === 'terminal') terminal = { cause: ev.cause, error: ev.error };
    if (ev.type === 'final_text') finalText = ev.text;
    if (ev.type === 'tool_call') console.log(`  · tool_call: ${ev.name} ${JSON.stringify(ev.args).slice(0, 160)}`);
    if (ev.type === 'tool_result') console.log(`  · tool_result ok=${ev.ok}: ${String(ev.output).slice(0, 100)}`);
    if (ev.type === 'log' && (ev.message.includes('topology') || ev.message.includes('model'))) console.log(`  · ${ev.message}`);
  },
};

console.log('▶ running PI (agent-as-tool) — asking it to write a file…');
await harness.run(
  {
    runId: 'smoke-aat',
    prompt: `Create a file named proof.txt in the current directory whose entire content is exactly: ${MARKER}\nThen stop.`,
    model: process.env.PI_MODEL ?? 'openrouter/anthropic/claude-3.5-haiku',
    signal: ac.signal,
    topology: 'agent-as-tool',
  },
  env,
  io,
);
clearTimeout(timer);

console.log(`\nterminal: ${JSON.stringify(terminal)}`);
const got = await env.readFile('proof.txt');
const text = got?.toString('utf8').trim();
console.log(`env.readFile('proof.txt') => ${text === undefined ? 'NULL' : JSON.stringify(text)}`);

if (text === MARKER || text?.includes(MARKER)) {
  console.log('\n✅ PASS — file landed in the ENV via env-routed tools (agent-as-tool works).');
  await env.destroy();
  process.exit(0);
} else {
  console.log('\n❌ FAIL — file not in env. Either tools ran on host scratch, or the agent did not write.');
  await env.destroy();
  process.exit(1);
}
