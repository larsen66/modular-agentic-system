// src/server/bootstrap.ts
// Import every adapter directory so each self-registers into the registry.
// This is the ONLY place that knows the set of adapters by path; the kernel
// resolves them purely by ref string afterwards.

// The canonical Tool + Skill sets. Self-register on import; pure data + lazy
// execute bodies, so importing is always safe. Must load BEFORE any run so the
// orchestrator can resolve its default kit.
import '../tools/index.js';
import '../skills/index.js';
// The LOCAL environment (host temp dir + child_process). Required by the
// CLI-credential harnesses, which write into a real host cwd.
import '../environments/local/index.js';
// The CLI-credential harnesses (mode 2): drive the user's existing local
// `hermes`/`claude`/`codex` logins headless — REAL generation with ZERO API keys. They
// self-register on import; they only spawn the binary at run() time, so importing
// is safe even when the CLI is absent or logged out.
import '../harnesses/cli/hermes.js';
import '../harnesses/cli/claude.js';
import '../harnesses/cli/codex.js';
// PI is the DEFAULT main agent (composition-root profile). Loaded EAGERLY (not in
// the optional set) so a load failure surfaces loudly at startup rather than as a
// confusing per-run UnknownRefError. Safe to import: the pi-coding-agent SDK is
// imported lazily inside run(), so module load needs nothing installed.
import '../harnesses/pi/index.js';

// The Docker env adapter pulls in `dockerode`. It self-registers on import but
// only constructs a Docker client lazily on provision(), so importing it is safe
// even when Docker isn't running. Loaded dynamically so a missing dockerode
// install never blocks the Dummy path.
export async function loadOptionalAdapters(): Promise<void> {
  await tryLoad('docker env', () => import('../environments/docker/index.js'));
  // Managed cloud sandbox adapters — each pulls its own SDK + needs an API key at
  // provision() time. Self-register on import; constructed lazily, so importing is
  // safe even without the key. A missing/broken SDK degrades to a warning.
  await tryLoad('e2b env', () => import('../environments/e2b/index.js'));
  await tryLoad('daytona env', () => import('../environments/daytona/index.js'));
  // codesandbox is the 3rd managed sandbox.
  await tryLoad('codesandbox env', () => import('../environments/codesandbox/index.js'));
  // Real harness adapters (opencode/pi mode 2; claude-agent-sdk + openai-agents mode 1).
  // Self-register on import; the LLM/SDK client is constructed lazily at run().
  await tryLoad('opencode harness', () => import('../harnesses/opencode/index.js'));
  await tryLoad('claude-agent-sdk harness', () => import('../harnesses/claude-agent-sdk/index.js'));
  await tryLoad('openai-agents harness', () => import('../harnesses/openai-agents/index.js'));
  // NOTE: pi is the DEFAULT main agent and is loaded EAGERLY at the top of this
  // module (not here) so its registration can't be silently swallowed.
}

async function tryLoad(label: string, loader: () => Promise<unknown>): Promise<void> {
  try {
    await loader();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(`[bootstrap] ${label} adapter not loaded: ${message}`);
  }
}
