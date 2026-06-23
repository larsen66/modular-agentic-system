// src/harnesses/opencode/verify.ts
// Self-skipping live verifier for the REAL OpenCode harness (mode 2).
//
// Run:  npx tsx src/harnesses/opencode/verify.ts
//
// This drives the FULL real path — spawn `opencode serve` inside the `local`
// environment, create a session, send a prompt, consume the SSE firehose, and
// translate it to EngineEvents — settling exactly once. It is NOT a mock: it
// makes real model calls through OpenCode's provider layer.
//
// Because mode-2 needs (a) the `opencode` binary reachable inside the env and
// (b) a model the binary can call, this verifier SKIPS cleanly (exit 0, loud
// reason) when either precondition is missing, instead of failing CI on a
// machine that simply lacks the binary or a key. Provide:
//   - `opencode` on PATH (the `local` env runs it on the host), AND
//   - one of: OPENAI_BASE_URL (+OPENAI_API_KEY) pointing at an OpenAI-compatible
//     gateway, ANTHROPIC_API_KEY, or a pre-authenticated `opencode auth` login.
//
// Exit 0 = PASS (real run settled done) OR SKIP (precondition missing).
// Exit 1 = the real path ran but FAILED (settled error / no settlement).

import { spawnSync } from 'node:child_process';

function hasOpencodeBinary(): boolean {
  const r = spawnSync('opencode', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function modelConfigured(): { ok: boolean; how: string } {
  if (process.env.OPENAI_BASE_URL) return { ok: true, how: `OPENAI_BASE_URL=${process.env.OPENAI_BASE_URL}` };
  if (process.env.OPENAI_API_KEY) return { ok: true, how: 'OPENAI_API_KEY' };
  if (process.env.ANTHROPIC_API_KEY) return { ok: true, how: 'ANTHROPIC_API_KEY' };
  if (process.env.OPENROUTER_API_KEY) return { ok: true, how: 'OPENROUTER_API_KEY' };
  if (process.env.OPENCODE_VERIFY_ASSUME_AUTH === '1')
    return { ok: true, how: 'OPENCODE_VERIFY_ASSUME_AUTH=1 (trusting `opencode auth` login)' };
  return { ok: false, how: '' };
}

function skip(reason: string): never {
  console.log('\n========================= opencode verify =========================');
  console.log(`SKIP ⏭   ${reason}`);
  console.log('To run live: ensure `opencode` is on PATH and set OPENAI_BASE_URL');
  console.log('(+OPENAI_API_KEY) / ANTHROPIC_API_KEY / OPENROUTER_API_KEY, or run');
  console.log('`opencode auth login` then set OPENCODE_VERIFY_ASSUME_AUTH=1.');
  console.log('===================================================================');
  process.exit(0);
}

async function main(): Promise<void> {
  if (!hasOpencodeBinary()) skip('`opencode` binary not found on PATH (mode-2 needs it inside the env).');
  const model = modelConfigured();
  if (!model.ok) skip('no model credential found for OpenCode to call.');

  console.log(`[opencode verify] preconditions met (binary ✓, model via ${model.how}); running live.`);

  // Import kernel + the adapters AFTER the precondition gate so a missing dep in
  // an unrelated adapter never trips the skip path.
  const { Kernel } = await import('../../kernel/index.js');
  await import('./index.js'); // self-registers 'opencode'
  await import('../../environments/local/index.js'); // self-registers 'local'

  const kernel = new Kernel();
  const seen = new Set<string>();
  let sawChunk = false;
  let terminalCause: string | null = null;

  console.log('\n[opencode verify] harness=opencode × environment=local\n');
  const handle = kernel.runMessage(
    {
      sessionId: 'verify-opencode',
      harness: 'opencode',
      environment: 'local',
      source: { kind: 'files', files: [] },
    },
    'In one sentence, say hello and name the framework you would scaffold a todo app with. Do not write any files.',
    (ev) => {
      seen.add(ev.type);
      if (ev.type === 'stream_chunk') sawChunk = true;
      if (ev.type === 'tool_call') console.log(`  → tool_call: ${ev.name}`);
      if (ev.type === 'usage_delta') console.log(`  · usage +${ev.inputTokens}in/${ev.outputTokens}out`);
      if (ev.type === 'log' && ev.level === 'error') console.log(`  ! ${ev.message}`);
      if (ev.type === 'final_text') console.log(`  ✎ final_text: ${ev.text.slice(0, 120)}`);
      if (ev.type === 'terminal') {
        terminalCause = ev.cause;
        console.log(`  ■ terminal: ${ev.cause}${ev.error ? ` (${ev.error.code}: ${ev.error.message})` : ''}`);
      }
    }
  );

  const result = await handle.result;
  await kernel.endSession('verify-opencode').catch(() => {});

  const settledOnce = terminalCause !== null;
  const pass = settledOnce && result.cause === 'done';

  console.log('\n========================= opencode verify =========================');
  console.log(`streamed text from real model: ${sawChunk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`settled exactly once:          ${settledOnce ? `YES ✓ (${terminalCause})` : 'NO ✗'}`);
  console.log(`terminal cause:                ${result.cause}`);
  console.log('===================================================================');
  console.log(pass ? '[opencode verify] PASS ✅  (real OpenCode mode-2 run)' : '[opencode verify] FAIL ❌');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[opencode verify] FAIL:', e);
  process.exit(1);
});
