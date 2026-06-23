// src/environments/codesandbox/index.ts
// The CodeSandbox environment adapter — the ONLY place the `@codesandbox/sdk`
// (CodeSandbox, SandboxClient, Command, CommandError) is allowed to appear.
// It satisfies the same opaque EnvironmentHandle contract the docker/e2b/daytona
// envs do; Core can swap any of them by a ref-string change and never learns
// there is a CodeSandbox VM behind the handle.
//
// API surface used (verified against @codesandbox/sdk@2.4.2 types):
//   new CodeSandbox(apiToken)             — client
//   sdk.sandboxes.create(opts?)           — Sandbox (metadata + id)
//   sdk.sandboxes.shutdown(id)            — graceful shutdown (files preserved)
//   sdk.hosts.createToken(id, {expiresAt}) — HostToken (for private sandbox preview)
//   sandbox.connect({env?})               — live WebSocket session → CsbSession
//   session.workspacePath                 — string (/project/sandbox or similar)
//   session.commands.run(cmd, opts?)      — Promise<string>; throws CommandError
//   session.commands.runBackground(cmd, opts?) — Promise<Command>
//   Command.status                        — CommandStatus (RUNNING/FINISHED/ERROR/KILLED)
//   (cmd as any).exitCode                 — number|undefined (private field, runtime only)
//   Command.onOutput(cb)                  — output event subscription
//   Command.waitUntilComplete()           — Promise<string> (output)
//   Command.kill()                        — Promise<void>
//   CommandError.exitCode / .output       — non-zero exit details
//   session.fs.batchWrite(files)          — batch write (string|Uint8Array)
//   session.fs.readFile(path)             — Promise<Uint8Array>
//   session.ports.waitForPort(port, opts) — Promise<Port>
//   session.hosts.getUrl(port, protocol)  — string (full URL; token-aware for private)
//   session.disconnect()                  — clean WebSocket close
//
// TypeScript/NodeNext note: `@codesandbox/sdk` does `export * from "./SandboxClient"`
// at the root index.d.ts, but tsc NodeNext only resolves the root index via the
// `exports` field — subdirectory re-exports are not visible as named top-level
// exports in NodeNext mode when there is no explicit `"./SandboxClient"` export
// entry in `package.json`. We therefore use local structural interfaces (matching
// what we actually call) and import `Sandbox` by name (it IS on the root Sandbox.d.ts).
// CommandError is reached via namespace import and cast. All runtime behaviour is
// correct — the class and all methods exist at runtime (verified independently).

import { CodeSandbox } from '@codesandbox/sdk';
// `Sandbox` re-exported from `./Sandbox.d.ts` fails in tsc NodeNext mode because
// `Sandbox.d.ts` itself imports `SandboxClient` from the `./SandboxClient` directory,
// which has no explicit subpath in the package's `exports` field. We derive the
// type instead from what tsc CAN follow: `CodeSandbox.sandboxes.create()` return.
type Sandbox = Awaited<ReturnType<InstanceType<typeof CodeSandbox>['sandboxes']['create']>>;
// CommandError: exported by the SDK at runtime, but TS NodeNext can't see it
// through the subdirectory re-export chain. We reach it via namespace import.
import * as _sdk_ns from '@codesandbox/sdk';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CommandError = (_sdk_ns as any)['CommandError'] as {
  new (...args: unknown[]): { exitCode: number; output: string };
  prototype: { exitCode: number; output: string };
};

import { registerEnvironment } from '../../registry/index.js';
import { HeaderPreviewProxy } from '../previewProxy.js';
import type {
  Environment,
  EnvironmentCapabilities,
  EnvironmentHandle,
  EnvLogger,
  ExecOpts,
  ExecResult,
  ProcessHandle,
  ProvisionSource,
  ProvisionSpec,
} from '../../types/index.js';

// ── Local structural interfaces ───────────────────────────────────────────────
// Describes only the subset of `SandboxClient` (i.e. the return of
// sandbox.connect()) that this adapter calls. Avoids importing the class by
// name across the NodeNext re-export gap.
type CommandStatus = 'RUNNING' | 'FINISHED' | 'ERROR' | 'KILLED' | 'RESTARTING';
interface CsbCommand {
  readonly status: CommandStatus;
  onOutput(cb: (chunk: string) => void): void;
  waitUntilComplete(): Promise<string>;
  kill(): Promise<void>;
}
interface CsbCommandsNs {
  runBackground(
    cmd: string,
    opts?: { cwd?: string; env?: Record<string, string> }
  ): Promise<CsbCommand>;
}
interface CsbFsNs {
  batchWrite(files: { path: string; content: string | Uint8Array }[]): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
}
interface CsbPortsNs {
  waitForPort(port: number, opts?: { timeoutMs?: number }): Promise<unknown>;
}
interface CsbHostsNs {
  getUrl(port: number, protocol?: string): string;
}
interface CsbSession {
  readonly id: string;
  readonly workspacePath: string;
  readonly commands: CsbCommandsNs;
  readonly fs: CsbFsNs;
  readonly ports: CsbPortsNs;
  readonly hosts: CsbHostsNs;
  disconnect(): Promise<void>;
}
// ─────────────────────────────────────────────────────────────────────────────

const CAPS: EnvironmentCapabilities = {
  publicPorts: true,  // hosts.getUrl(port) + host token → full public preview URL
  pty: false,         // SDK has Terminals; MVP exec contract is non-interactive
  snapshot: false,    // SDK supports hibernate; not wired for the MVP kernel
  nativeGit: false,   // No native git API — clone-inside via exec
  fileWatch: false,   // SDK has fs.watch; not wired for the MVP
  persistentVolume: false,
  hostsAgentRuntime: true, // detached exec + hosts.getUrl exposePort → agent-in-sandbox OK
};

const noopLog: EnvLogger = () => {};

// ProcessHandle adapter for a CodeSandbox background Command. The SDK's
// Command.exitCode is a private TypeScript field but IS present at runtime once
// the command finishes. We reach it via `(cmd as any).exitCode` when the status
// is terminal; while RUNNING/RESTARTING we return null (still running).
class CsbProcess implements ProcessHandle {
  private cachedExit: number | null = null;
  private waitPromise: Promise<number> | null = null;

  constructor(private readonly cmd: CsbCommand) {}

  async poll(): Promise<number | null> {
    if (this.cachedExit !== null) return this.cachedExit;
    const status = this.cmd.status;
    if (status === 'RUNNING' || status === 'RESTARTING') return null;
    // Terminal — read the private exitCode field at runtime via cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (this.cmd as any).exitCode as number | undefined;
    if (typeof code === 'number') {
      this.cachedExit = code;
      return code;
    }
    // KILLED with no recorded exit → -1 (conventional "killed by signal").
    // ERROR with no exit → 1 (non-zero, unknown).
    this.cachedExit = status === 'KILLED' ? -1 : 1;
    return this.cachedExit;
  }

  async wait(): Promise<number> {
    if (this.cachedExit !== null) return this.cachedExit;
    if (!this.waitPromise) {
      this.waitPromise = this.cmd
        .waitUntilComplete()
        .then(() => {
          this.cachedExit = 0;
          return 0 as number;
        })
        .catch((err: unknown) => {
          // CommandError on non-zero exit.
          const code =
            err instanceof CommandError ? (err as { exitCode: number }).exitCode : 1;
          this.cachedExit = code;
          return code as number;
        });
    }
    return this.waitPromise;
  }

  async kill(_signal?: string): Promise<void> {
    // SDK kill() removes the command shell; no POSIX signal forwarding.
    await this.cmd.kill().catch(() => {});
    if (this.cachedExit === null) this.cachedExit = -1;
  }
}

class CsbHandle implements EnvironmentHandle {
  readonly capabilities = CAPS;

  constructor(
    readonly id: string,                  // sandbox id — opaque to Core
    private readonly session: CsbSession,
    private readonly sdk: CodeSandbox,
    private readonly proxy: HeaderPreviewProxy,
    private readonly log: EnvLogger = noopLog
  ) {}

  // CodeSandbox fs methods operate relative to the connected workspace. Passing
  // absolute workspace paths makes the SDK zip/upload helper fail with
  // "Unzip command failed", so keep user paths workspace-relative here.
  private resolve(p: string): string {
    return p.replace(/^\/+/, '');
  }

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    const cwd = opts?.cwd ?? this.session.workspacePath;
    const env = opts?.env;

    if (opts?.detached) {
      this.log('info', `dev server starting (background): ${cmd}`);
      // runBackground returns a Command handle immediately; the shell keeps running.
      const handle = await this.session.commands.runBackground(cmd, { cwd, env });
      // Wire the output callback for the caller's streaming sink if provided.
      if (opts.onStdout) handle.onOutput((chunk: string) => opts.onStdout!(chunk));
      return new CsbProcess(handle);
    }

    this.log('info', `exec: ${cmd}`);
    const startedAt = Date.now();

    // runBackground + waitUntilComplete lets us pipe onOutput chunks to the
    // caller's streaming callback while still getting the final combined output.
    // (run() would buffer and return only at the end, no streaming.)
    try {
      const handle = await this.session.commands.runBackground(cmd, { cwd, env });
      if (opts?.onStdout) handle.onOutput((chunk: string) => opts.onStdout!(chunk));
      const output = await handle.waitUntilComplete();
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      this.log('info', `exec exit 0 (${secs}s): ${cmd}`);
      return { exitCode: 0, stdout: output.trim(), stderr: '' };
    } catch (err: unknown) {
      if (err instanceof CommandError) {
        const csbErr = err as { exitCode: number; output: string };
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        this.log('error', `exec exit ${csbErr.exitCode} (${secs}s): ${cmd}`);
        return {
          exitCode: csbErr.exitCode,
          stdout: csbErr.output.trim(),
          stderr: csbErr.output.trim(), // no split channel on this path
        };
      }
      throw err;
    }
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    if (!files.length) return;
    // batchWrite zips and uploads in one round-trip — more efficient than N
    // individual writeTextFile/writeFile calls.
    const batch = files.map((f) => ({
      path: this.resolve(f.path),
      content: Buffer.isBuffer(f.content) ? bufferToUint8Array(f.content) : f.content,
    }));
    await this.session.fs.batchWrite(batch);
    if (files.length === 1) this.log('info', `wrote file ${files[0]!.path}`);
    else this.log('info', `wrote ${files.length} files`);
  }

  async readFile(filePath: string): Promise<Buffer | null> {
    try {
      const bytes = await this.session.fs.readFile(this.resolve(filePath));
      return Buffer.from(bytes);
    } catch {
      // Missing file or any FS error → null, matching docker/e2b/daytona semantics.
      return null;
    }
  }

  async exposePort(port: number): Promise<{ url: string; token?: string }> {
    // Construct the preview URL for this sandbox + port. For private sandboxes
    // we mint a short-lived host token (10-minute TTL). The caller attaches it
    // as the `csb-preview-token` header (or cookie) to reach the preview.
    const url = this.session.hosts.getUrl(port, 'https');
    this.log('info', `port ${port} exposed → ${url}`);

    let token: string | undefined;
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      const hostToken = await this.sdk.hosts.createToken(this.id, { expiresAt });
      token = hostToken.token;
    } catch {
      // If token minting fails (public sandbox or insufficient permissions),
      // surface the URL alone — the caller may already have access.
    }

    if (!token) return { url };
    return { url: this.sdk.hosts.getUrl({ sandboxId: this.id, token }, port, 'https') };
  }

  async waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
    // Native SDK port watcher — cleaner than polling nc/node inside the sandbox.
    await this.session.ports.waitForPort(port, { timeoutMs });
    this.log('info', `port ${port} is open`);
  }

  async destroy(): Promise<void> {
    this.log('info', `shutting down sandbox ${this.id}`);
    await this.proxy.destroy().catch(() => {});
    // disconnect() releases the WebSocket session cleanly, then shutdown()
    // hibernates the sandbox (files preserved, no VM credits consumed).
    await this.session.disconnect().catch(() => {});
    await this.sdk.sandboxes.shutdown(this.id).catch(() => {});
    this.log('info', 'sandbox shut down');
  }
}

class CsbEnvironment implements Environment {
  readonly ref = 'codesandbox';
  readonly capabilities = CAPS;

  async provision(spec: ProvisionSpec): Promise<EnvironmentHandle> {
    const log = spec.logger ?? noopLog;

    const apiKey = process.env.CSB_API_KEY;
    if (!apiKey) {
      throw new Error(
        'codesandbox: CSB_API_KEY is not set. Get a key at https://codesandbox.io/t/api and export CSB_API_KEY before provisioning.'
      );
    }

    log('info', 'provisioning env (codesandbox sandbox)');
    const sdk = new CodeSandbox(apiKey);

    // runtimeProfile maps to a fork-from sandbox template ID (the `id` field in
    // CreateSandboxOpts). The universal template is used when unset.
    const sandbox: Sandbox = await sdk.sandboxes.create({
      ...(spec.runtimeProfile ? { id: spec.runtimeProfile } : {}),
      tags: ['modular-runner'],
      privacy: 'private', // exposePort returns a browser-openable local proxy
    });
    log('info', `sandbox created ${sandbox.id}`);

    // connect() opens the WebSocket session. We pass env vars so they're
    // available inside the sandbox (process.env in Node commands, etc.).
    const session = await sandbox.connect({ env: spec.env }) as unknown as CsbSession;
    log('info', 'connected to sandbox agent');

    const handle = new CsbHandle(sandbox.id, session, sdk, new HeaderPreviewProxy(), log);
    await materialize(handle, session, spec.source, log);
    log('info', 'workspace materialized');
    return handle;
  }
}

async function materialize(
  handle: CsbHandle,
  session: CsbSession,
  source: ProvisionSource,
  log: EnvLogger
): Promise<void> {
  if (source.kind === 'files') {
    if (source.files.length) await handle.writeFiles(source.files);
  } else if (source.kind === 'git') {
    // nativeGit is false — clone-inside via exec, same as the e2b fallback.
    // Clone into '.' so the repo root IS the workspace.
    log('info', `cloning ${source.url} (exec clone) → ${session.workspacePath}`);
    const token = source.token ? `${source.token}@` : '';
    const url = source.url.replace('https://', `https://${token}`);
    const depth = source.depth ?? 1;
    await handle.exec(`git clone --depth ${depth} ${url} .`, {
      cwd: session.workspacePath,
    });
    if (source.revision) {
      await handle.exec(
        `git fetch --depth 1 origin ${source.revision} && git checkout ${source.revision}`,
        { cwd: session.workspacePath }
      );
    }
  } else {
    // kind === 'cache' — no snapshot/cache wiring for the MVP codesandbox path.
    throw new Error(`codesandbox: source.kind "cache" is not supported in the MVP adapter`);
  }
}

// Buffer is a Node ArrayBufferView; hand the SDK a tight Uint8Array view so
// the underlying bytes are written verbatim (avoids a possibly-oversized
// backing ArrayBuffer when the Buffer is a slice of a pool).
function bufferToUint8Array(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

registerEnvironment('codesandbox', () => new CsbEnvironment());

// Re-exported so the verify script and same-family callers can construct the
// adapter directly without going through the registry.
export { CsbEnvironment, CsbHandle };
