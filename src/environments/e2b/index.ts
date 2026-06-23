// src/environments/e2b/index.ts
// The E2B environment adapter — the ONLY place the `e2b` SDK (Sandbox /
// getHost / trafficAccessToken) is allowed to appear (legacy rule R6 + the grep
// gate, which forbids the word `e2b` everywhere EXCEPT this adapter dir). It
// satisfies the SAME opaque EnvironmentHandle contract the docker/local/dummy
// envs do; Core can swap any of them by a ref-string change and never learns
// there is a managed microVM sandbox behind the handle.
//
// Unlike Docker (host-port + reverse proxy) or Local (direct host port), E2B
// hands back a hostname per port via `getHost(port)`. Private previews need a
// traffic token header, so the adapter wraps that URL in a local proxy and Core
// still receives a browser-openable finished URL.

import { Sandbox, CommandExitError } from 'e2b';
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
  ProvisionSpec,
} from '../../types/index.js';

const CAPS: EnvironmentCapabilities = {
  publicPorts: true, // getHost(port) → a real public https hostname
  pty: false, // the SDK has a pty module, but the kernel MVP doesn't drive it
  snapshot: false, // SDK supports snapshots; left off until the kernel needs it
  nativeGit: false, // MVP: clone-inside via exec when source.kind === 'git'
  fileWatch: false, // SDK has filesystem watch; not wired for the MVP
  persistentVolume: false,
  hostsAgentRuntime: true, // detached exec + getHost(port) exposePort → agent-in-sandbox OK
};

// E2B sandboxes default the command user's home (/home/user) as cwd. We keep a
// single workspace dir so write/read/exec are symmetric the way the other envs
// resolve relative paths against a fixed WORKDIR.
const WORKDIR = '/home/user/workspace';

const noopLog: EnvLogger = () => {};

// A background command (dev server) wrapped in the ProcessHandle contract. The
// SDK's CommandHandle already exposes pid/wait/kill — we adapt it to the
// substrate-free poll()/wait()/kill() shape Core's `isProcessHandle` narrows on.
type RunningCommand = {
  readonly pid: number;
  readonly exitCode: number | undefined; // undefined while still running
  wait(): Promise<{ exitCode: number }>;
  kill(): Promise<boolean>;
};

class E2bProcess implements ProcessHandle {
  // Cache the terminal exit code once observed so poll() stays cheap and stable.
  private settled: number | null = null;

  constructor(private readonly cmd: RunningCommand) {}

  get pid(): number | undefined {
    return this.cmd.pid;
  }

  async poll(): Promise<number | null> {
    if (this.settled !== null) return this.settled;
    const code = this.cmd.exitCode;
    if (typeof code === 'number') {
      this.settled = code;
      return code;
    }
    return null; // still running
  }

  async wait(): Promise<number> {
    if (this.settled !== null) return this.settled;
    try {
      const result = await this.cmd.wait();
      this.settled = result.exitCode;
      return this.settled;
    } catch (err) {
      // wait() rejects with CommandExitError on non-zero exit — surface the code
      // rather than throwing, mirroring ExecResult semantics.
      this.settled = err instanceof CommandExitError ? err.exitCode : 1;
      return this.settled;
    }
  }

  async kill(): Promise<void> {
    // The SDK kill() is signal-less (SIGKILL); the contract's optional `signal`
    // arg has no E2B analogue, so it is accepted and ignored.
    await this.cmd.kill().catch(() => {});
  }
}

class E2bHandle implements EnvironmentHandle {
  readonly capabilities = CAPS;

  constructor(
    readonly id: string, // sandboxId — opaque to Core, lives only here
    private readonly sandbox: Sandbox,
    private readonly proxy: HeaderPreviewProxy,
    private readonly log: EnvLogger = noopLog // narrates substrate lifecycle to the UI
  ) {}

  // Resolve relative paths against WORKDIR so write/read/exec share one base.
  private resolve(p: string): string {
    if (p.startsWith('/')) return p;
    return `${WORKDIR}/${p}`;
  }

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    const cwd = opts?.cwd ?? WORKDIR;
    const envs = opts?.env;

    if (opts?.detached) {
      this.log('info', `dev server starting (background): ${cmd}`);
      // background: true returns a CommandHandle immediately (a long-running
      // dev server). We adapt it to the ProcessHandle contract.
      const handle = await this.sandbox.commands.run(cmd, {
        background: true,
        cwd,
        envs,
        onStdout: opts?.onStdout ? (d: string) => opts.onStdout!(d) : undefined,
        onStderr: opts?.onStderr ? (d: string) => opts.onStderr!(d) : undefined,
      });
      return new E2bProcess(handle);
    }

    this.log('info', `exec: ${cmd}`);
    const startedAt = Date.now();
    try {
      const result = await this.sandbox.commands.run(cmd, {
        background: false,
        cwd,
        envs,
        timeoutMs: opts?.timeoutMs,
        onStdout: opts?.onStdout ? (d: string) => opts.onStdout!(d) : undefined,
        onStderr: opts?.onStderr ? (d: string) => opts.onStderr!(d) : undefined,
      });
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      this.log('info', `exec exit ${result.exitCode} (${secs}s): ${cmd}`);
      return {
        exitCode: result.exitCode,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      };
    } catch (err) {
      // The SDK throws CommandExitError on a non-zero exit. The EnvironmentHandle
      // contract expects a non-zero exitCode IN the result (like docker/local),
      // not a throw — so translate it back into an ExecResult.
      if (err instanceof CommandExitError) {
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        this.log('error', `exec exit ${err.exitCode} (${secs}s): ${cmd}`);
        return {
          exitCode: err.exitCode,
          stdout: err.stdout.trim(),
          stderr: err.stderr.trim(),
        };
      }
      throw err;
    }
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    if (!files.length) return;
    // files.write accepts a batch of { path, data }. Buffer is an ArrayBufferView;
    // pass its underlying bytes for binary content, raw string otherwise.
    const entries = files.map((f) => ({
      path: this.resolve(f.path),
      // e2b v2 `files.write` accepts string | ArrayBuffer | Blob | ReadableStream
      // (NOT a bare Uint8Array) — wrap binary bytes in a Blob.
      data: Buffer.isBuffer(f.content) ? new Blob([bufferToBytes(f.content)]) : f.content,
    }));
    await this.sandbox.files.write(entries);
    if (files.length === 1) this.log('info', `wrote file ${files[0]!.path}`);
    else this.log('info', `wrote ${files.length} files`);
  }

  async readFile(filePath: string): Promise<Buffer | null> {
    try {
      const bytes = await this.sandbox.files.read(this.resolve(filePath), { format: 'bytes' });
      return Buffer.from(bytes);
    } catch {
      // Missing file (or any read error) → null, matching docker/local semantics.
      return null;
    }
  }

  async exposePort(port: number): Promise<{ url: string; token?: string }> {
    // THE differentiating capability: E2B gives a real hostname per port. For
    // private sandboxes, a traffic token header is required, so hide it behind a
    // local proxy. Core/history/events never receive the token.
    const host = this.sandbox.getHost(port);
    const upstreamUrl = `https://${host}`;
    const token = this.sandbox.trafficAccessToken;
    const { url } = token
      ? await this.proxy.exposeUrl(upstreamUrl, { 'e2b-traffic-access-token': token })
      : { url: upstreamUrl };
    this.log('info', `port ${port} exposed → ${url}`);
    return { url };
  }

  async waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
    // Portable readiness probe run INSIDE the sandbox. Prefer `nc` (busybox),
    // fall back to a node one-liner (E2B base templates ship node). No bash-isms.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const r = await this.exec(
        `nc -z 127.0.0.1 ${port} && echo open || ` +
          `node -e 'require("net").connect(${port},"127.0.0.1").on("connect",()=>{console.log("open");process.exit(0)}).on("error",()=>{console.log("closed");process.exit(0)})'`
      );
      // exec without detached always resolves to ExecResult here.
      if ('stdout' in r && r.stdout.includes('open')) return;
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error(`waitForPort(${port}) timed out`);
  }

  async destroy(): Promise<void> {
    this.log('info', `tearing down sandbox ${this.id}`);
    await this.proxy.destroy().catch(() => {});
    await this.sandbox.kill().catch(() => {});
    this.log('info', 'sandbox killed');
  }
}

class E2bEnvironment implements Environment {
  readonly ref = 'e2b';
  readonly capabilities = CAPS;

  async provision(spec: ProvisionSpec): Promise<EnvironmentHandle> {
    const log = spec.logger ?? noopLog;
    // runtimeProfile maps to an E2B template name/ID; default `base` covers
    // node/npm/Vite out of the box.
    const template = spec.runtimeProfile;
    log('info', `provisioning env (e2b ${template ?? 'base'})`);

    // secure: true keeps the provider preview private; exposePort returns a
    // localhost proxy URL that injects the traffic token header.
    //
    // NOTE: ProvisionSpec has no sandbox-lifetime field, so we let the E2B
    // default keep-alive apply. A run-time `setTimeout` extension would be driven
    // by the kernel via a future spec field — not faked here.
    const opts = {
      envs: spec.env,
      secure: true,
      metadata: spec.labels,
    };
    const sandbox = template
      ? await Sandbox.create(template, opts)
      : await Sandbox.create(opts);
    log('info', `sandbox created ${sandbox.sandboxId}`);

    const handle = new E2bHandle(sandbox.sandboxId, sandbox, new HeaderPreviewProxy(), log);
    // Ensure the workspace dir exists before materialize writes/clones into it.
    // Run from '/' — exec defaults cwd to WORKDIR, which doesn't exist YET (the
    // very command meant to create it), so e2b rejects with "cwd does not exist".
    await handle.exec(`mkdir -p ${WORKDIR}`, { cwd: '/' });

    await this.materialize(handle, spec);
    log('info', 'workspace materialized');
    return handle;
  }

  private async materialize(handle: E2bHandle, spec: ProvisionSpec): Promise<void> {
    if (spec.source.kind === 'files') {
      // writeFiles resolves relative paths against WORKDIR — pass raw.
      if (spec.source.files.length) await handle.writeFiles(spec.source.files);
    } else if (spec.source.kind === 'git') {
      // No native git capability advertised → clone-inside via exec (the kernel's
      // fallback ladder lands here when nativeGit is false). Clone into '.'
      // (cwd = WORKDIR) so the repo root IS the workspace, then checkout revision.
      const token = spec.source.token ? `${spec.source.token}@` : '';
      const url = spec.source.url.replace('https://', `https://${token}`);
      const depth = spec.source.depth ?? 1;
      await handle.exec(`git clone --depth ${depth} ${url} .`);
      if (spec.source.revision) {
        await handle.exec(`git fetch --depth 1 origin ${spec.source.revision} && git checkout ${spec.source.revision}`);
      }
    }
  }
}

// Buffer is a Node ArrayBufferView; hand the SDK a tight Uint8Array view so the
// underlying bytes are written verbatim (avoids passing a possibly-oversized
// backing ArrayBuffer when the Buffer is a slice of a pool).
function bufferToBytes(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

registerEnvironment('e2b', () => new E2bEnvironment());
