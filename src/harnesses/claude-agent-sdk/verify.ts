// src/harnesses/claude-agent-sdk/verify.ts
// `tsx src/harnesses/claude-agent-sdk/verify.ts` — self-contained acceptance check for
// the REAL claude-agent-sdk harness, now built on the Claude Agent SDK `query()` loop.
// It drives the ACTUAL harness (Agent SDK agent loop → in-process MCP tools → tool
// routing to the EnvironmentHandle → settlement) against an in-memory FakeEnv that
// implements EnvironmentHandle. Everything is real EXCEPT the substrate (files /
// exec / ports are in-memory); the model + agent loop are the genuine Agent SDK.
//
// Unlike the previous Messages-API harness, the Agent SDK spawns a bundled native
// `claude` subprocess for the loop — there is no simple wire to mock. So this
// verify REQUIRES a real ANTHROPIC_API_KEY (or an ANTHROPIC_BASE_URL compat
// endpoint). With neither configured it SKIPs (exit 0, clearly labelled) — never a
// silent pass, never a hard failure for a missing key.
//
// Proves, with a real key but ZERO real substrate:
//   • the Agent SDK loop runs and routes every tool_use to the EnvironmentHandle,
//   • files are written into the env (not the harness's local disk),
//   • a preview URL is exposed through the handle,
//   • settlement fires EXACTLY ONCE with cause=done.

import type {
  EngineEvent,
  EnvironmentCapabilities,
  EnvironmentHandle,
  ExecOpts,
  ExecResult,
  ProcessHandle,
} from '../../types/index.js';

// ── In-memory env: implements the handle so tool routing is REAL, infra is not ──
class FakeEnv implements EnvironmentHandle {
  readonly id = 'fake-env';
  readonly capabilities: EnvironmentCapabilities = {
    publicPorts: true,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: true,
  };
  readonly files = new Map<string, string>();
  readonly commands: string[] = [];
  exposedPort: number | null = null;

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    this.commands.push(cmd);
    if (opts?.detached) {
      const handle: ProcessHandle = {
        pid: 4242,
        async poll() {
          return null;
        },
        async wait() {
          return 0;
        },
        async kill() {
          /* no-op */
        },
      };
      return handle;
    }
    return { exitCode: 0, stdout: `[fake] ran: ${cmd}`, stderr: '' };
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    for (const f of files) this.files.set(f.path, f.content.toString());
  }

  async readFile(p: string): Promise<Buffer | null> {
    const c = this.files.get(p);
    return c == null ? null : Buffer.from(c, 'utf8');
  }

  async waitForPort(): Promise<void> {
    /* always ready in the fake */
  }

  async exposePort(port: number): Promise<{ url: string; token?: string }> {
    this.exposedPort = port;
    return { url: `http://fake-preview.local:${port}/` };
  }

  async destroy(): Promise<void> {
    /* no-op */
  }
}

async function main() {
  const { describeClaudeSdk } = await import('./client.js');
  const health = describeClaudeSdk();
  console.log('[verify:claude-agent-sdk] health:', JSON.stringify(health));
  if (!health.available) {
    console.log(
      '[verify:claude-agent-sdk] SKIP ⚠️  — no ANTHROPIC_API_KEY and no ANTHROPIC_BASE_URL. ' +
        'The Agent SDK runs a bundled `claude` subprocess that cannot be wire-mocked, ' +
        'so a real key (or compat endpoint) is required. Nothing proven, but not a failure.'
    );
    process.exit(0);
  }

  // Confirm the package is importable before claiming anything.
  try {
    const { loadAgentSdk } = await import('./client.js');
    await loadAgentSdk();
  } catch (e) {
    console.log('[verify:claude-agent-sdk] SKIP ⚠️  — @anthropic-ai/claude-agent-sdk not importable:', (e as Error).message);
    process.exit(0);
  }

  const { ClaudeAgentSdkHarness } = await import('./index.js');

  const env = new FakeEnv();
  const events: EngineEvent[] = [];
  let terminalCount = 0;
  let previewUrl: string | null = null;
  let toolOk = false;

  const harness = new ClaudeAgentSdkHarness();
  const controller = new AbortController();

  await harness.run(
    { runId: 'verify-claude-agent-sdk', prompt: 'Build me a tiny todo app', topology: 'agent-as-tool', signal: controller.signal },
    env,
    {
      emit: (ev) => {
        events.push(ev);
        if (ev.type === 'tool_call') console.log(`  → ${ev.name}`);
        if (ev.type === 'tool_result' && ev.ok) toolOk = true;
        if (ev.type === 'preview_ready') {
          previewUrl = ev.url;
          console.log(`  ★ preview_ready: ${ev.url}`);
        }
        if (ev.type === 'terminal') {
          terminalCount++;
          console.log(`  ■ terminal: ${ev.cause}${ev.error ? ' — ' + ev.error.message : ''}`);
        }
      },
    }
  );

  const terminal = events.find((e) => e.type === 'terminal') as
    | Extract<EngineEvent, { type: 'terminal' }>
    | undefined;
  const wroteFiles = env.files.size > 0;
  const ranInstall = env.commands.some((c) => c.includes('npm install') || c.includes('install'));
  const startedDev = env.commands.some((c) => c.includes('dev') || c.includes('vite'));

  console.log('\n================== verify:claude-agent-sdk ==================');
  console.log(`harness ran tools through the handle:  ${toolOk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`wrote files into env:                  ${wroteFiles ? `YES ✓ (${env.files.size})` : 'NO ✗'}`);
  console.log(`ran an install command:                ${ranInstall ? 'YES ✓' : '— (model-dependent)'}`);
  console.log(`started dev server:                    ${startedDev ? 'YES ✓' : '— (model-dependent)'}`);
  console.log(`preview_ready emitted:                 ${previewUrl ? 'YES ✓ ' + previewUrl : '— (model-dependent)'}`);
  console.log(`exposed port on the handle:            ${env.exposedPort ? 'YES ✓ ' + env.exposedPort : '—'}`);
  console.log(`settled EXACTLY once (cause=${terminal?.cause ?? 'none'}):    ${terminalCount === 1 ? 'YES ✓' : `NO ✗ (count=${terminalCount})`}`);
  console.log('======================================================');

  // Core seam proof (deterministic regardless of model phrasing): the Agent SDK
  // loop routed real tool calls to the handle, wrote into the env, and settled
  // exactly once with done. The install/dev/preview steps are model-dependent and
  // reported but not required to avoid flakiness.
  const pass = toolOk && wroteFiles && terminalCount === 1 && terminal?.cause === 'done';

  console.log(
    pass
      ? '\n[verify:claude-agent-sdk] PASS ✅  (real Agent SDK loop × real tool routing through the handle; only the substrate is faked)'
      : '\n[verify:claude-agent-sdk] FAIL ❌'
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[verify:claude-agent-sdk] FAIL:', e);
  process.exit(1);
});
