// src/environments/daytona/index.ts
// The Daytona environment adapter — the ONLY place the @daytonaio/sdk, the
// Sandbox object, getPreviewLink, or the daytona.works preview host are allowed
// to appear (legacy rule R6). It satisfies the SAME opaque EnvironmentHandle
// contract the docker/local/dummy envs do; Core can swap any of them by a
// ref-string change and never learns there is a managed cloud sandbox behind
// the handle.
//
// Why Daytona is a strong contract match (docs/research/environments.md §3):
//   - native `sandbox.git.clone(url, path)`           → nativeGit = true
//   - native `sandbox.getPreviewLink(port)`           → publicPorts = true
//     returns a FULL public URL (https://{port}-{id}.proxy.daytona.works) plus a
//     token for private sandboxes. The entire preview/proxy apparatus is sealed
//     inside this adapter — Core only ever receives a finished `{ url, token }`.
//   - `sandbox.fs.uploadFiles/downloadFile`           → writeFiles / readFile
//   - `sandbox.process.executeCommand`                → exec (non-detached)
//   - `sandbox.process.createSession` + `executeSessionCommand({runAsync:true})`
//                                                     → exec (detached, real
//                                                       ProcessHandle: poll/wait/kill)
//
// LICENSE NOTE: the @daytonaio/sdk npm package is Apache-2.0 (the client). The
// Daytona SERVER (daytonaio/daytona) is AGPL-3.0 — network-copyleft only matters
// if you SELF-HOST and MODIFY the server. Using Daytona's managed cloud through
// this Apache-2.0 client SDK carries no copyleft obligation. See §3 of the
// research doc for the full caveat.

import { Daytona, type Sandbox } from '@daytonaio/sdk';
import { registerEnvironment } from '../../registry/index.js';
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

const CAPS: EnvironmentCapabilities = {
  publicPorts: true, // native getPreviewLink → full public URL + token
  pty: false, // SDK has createPty, but the MVP exec contract is non-interactive
  snapshot: false, // SDK has _experimental_createSnapshot; not wired for MVP
  nativeGit: true, // native sandbox.git.clone — no clone-inside fallback needed
  fileWatch: false,
  persistentVolume: false,
  hostsAgentRuntime: true, // detached exec + getPreviewLink exposePort → agent-in-sandbox OK
};

// Where we materialize the workspace. Daytona resolves relative fs/git/exec
// paths against the sandbox working directory, so we keep a single explicit
// base and resolve every path against it — write/read/exec stay symmetric, the
// same discipline the docker adapter uses with /workspace.
const WORKDIR = 'workspace';
const DEFAULT_AUTO_STOP_MINUTES = 15;
const DEFAULT_AUTO_ARCHIVE_MINUTES = 60;
const POSIX_SHELL = '/bin/sh';
const DEFAULT_USER = 'daytona';

const noopLog: EnvLogger = () => {};

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}

function envInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function lifecyclePolicy() {
  // Daytona docs: ephemeral sandboxes are deleted once stopped, and
  // autoDeleteInterval:0 is the equivalent declarative setting. Default to that
  // for this runner's short-lived preview/eval work so abandoned sessions do not
  // keep consuming org disk quota.
  const ephemeral = envFlag('DAYTONA_EPHEMERAL', true) && !envFlag('DAYTONA_PERSIST_SANDBOX', false);
  const autoStopInterval = envInt('DAYTONA_AUTO_STOP_MINUTES', DEFAULT_AUTO_STOP_MINUTES);

  if (ephemeral) {
    return { ephemeral: true, autoStopInterval, autoDeleteInterval: 0 };
  }

  return {
    autoStopInterval,
    autoArchiveInterval: envInt('DAYTONA_AUTO_ARCHIVE_MINUTES', DEFAULT_AUTO_ARCHIVE_MINUTES),
    autoDeleteInterval: -1,
  };
}

function explainProvisionError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/total disk limit exceeded|disk limit|storage space/i.test(message)) {
    return new Error(
      `daytona: organization disk quota is exhausted while creating a sandbox. ` +
        `Archive or delete unused Daytona sandboxes, then retry. This adapter now defaults ` +
        `new short-lived runs to DAYTONA_EPHEMERAL=1 / autoDeleteInterval=0 so stopped ` +
        `sandboxes do not keep consuming disk. Original error: ${message}`
    );
  }
  return err instanceof Error ? err : new Error(message);
}

function quoteSh(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function shellEnv(env?: Record<string, string>): Record<string, string> {
  return { ...(env ?? {}), SHELL: POSIX_SHELL };
}

function shellCommand(cmd: string): string {
  return `${POSIX_SHELL} -lc ${quoteSh(cmd)}`;
}

function commandInCwd(cmd: string, cwd: string): string {
  return shellCommand(`cd ${quoteSh(cwd)} && ${cmd}`);
}

// Resolve a caller path (which may be absolute or relative to the project root)
// to a path under WORKDIR. Mirrors the docker adapter's WORKDIR-relative rule so
// readFile/writeFiles/exec agree on where files live.
function underWorkdir(p: string): string {
  if (p.startsWith('/')) return p.replace(/^\/+/, '');
  return `${WORKDIR}/${p}`;
}

// A long-running command launched in a Daytona background session. Daytona
// sessions persist process state across calls, so a dev server started with
// runAsync:true survives — we poll the session command for its exit code, wait
// on it, and kill it via the session. This is a REAL ProcessHandle (not a
// detach-and-forget): poll/wait/kill all hit the live session command.
class DaytonaProcess implements ProcessHandle {
  private cachedExit: number | null = null;

  constructor(
    private readonly sandbox: Sandbox,
    private readonly sessionId: string,
    private readonly commandId: string,
    private readonly log: EnvLogger = noopLog
  ) {}

  async poll(): Promise<number | null> {
    if (this.cachedExit !== null) return this.cachedExit;
    try {
      const cmd = await this.sandbox.process.getSessionCommand(this.sessionId, this.commandId);
      // exitCode is populated only once the command has finished; while it runs
      // it is null/undefined — which is exactly the "still running" signal.
      const code = cmd.exitCode;
      if (code === null || code === undefined) return null;
      this.cachedExit = code;
      return code;
    } catch {
      return null;
    }
  }

  async wait(): Promise<number> {
    // Poll the session command until it reports an exit code. (The SDK exposes
    // log streaming but no blocking wait, so we poll — bounded only by the
    // caller's own teardown, same as a real dev server you eventually kill.)
    for (;;) {
      const code = await this.poll();
      if (code !== null) return code;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async kill(_signal?: string): Promise<void> {
    // Deleting the session terminates its background process tree. The session
    // is single-purpose (one detached command), so this is the kill.
    this.log('info', `killing background session ${this.sessionId}`);
    await this.sandbox.process.deleteSession(this.sessionId).catch(() => {});
  }
}

class DaytonaHandle implements EnvironmentHandle {
  readonly capabilities = CAPS;
  private sessionSeq = 0;

  constructor(
    readonly id: string, // sandbox id — opaque to Core, lives only here
    private readonly sandbox: Sandbox,
    private readonly log: EnvLogger = noopLog
  ) {}

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    const cwd = opts?.cwd ?? WORKDIR;

    if (opts?.detached) {
      // Long-running (dev server): run in a background session so it survives
      // past this call and we can poll/wait/kill it. We cd into cwd inside the
      // command because the session command's working dir defaults to the
      // sandbox root, and the SessionExecuteRequest has no cwd field.
      this.log('info', `dev server starting (background): ${cmd}`);
      const sessionId = `dev-${Date.now()}-${this.sessionSeq++}`;
      await this.sandbox.process.createSession(sessionId);
      const res = await this.sandbox.process.executeSessionCommand(sessionId, {
        command: commandInCwd(cmd, cwd),
        runAsync: true, // returns immediately; process keeps running in the session
      });
      const commandId = res.cmdId;
      if (!commandId) {
        await this.sandbox.process.deleteSession(sessionId).catch(() => {});
        throw new Error('daytona: background session command returned no cmdId');
      }
      return new DaytonaProcess(this.sandbox, sessionId, commandId, this.log);
    }

    this.log('info', `exec: ${cmd}`);
    const startedAt = Date.now();
    // executeCommand(command, cwd?, env?, timeout?) — timeout is in SECONDS.
    const timeoutSec = opts?.timeoutMs ? Math.ceil(opts.timeoutMs / 1000) : undefined;
    const res = await this.sandbox.process.executeCommand(
      commandInCwd(cmd, cwd),
      undefined,
      shellEnv(opts?.env),
      timeoutSec
    );

    // The toolbox returns a single combined `result` stream (no split stderr on
    // the non-session path). Surface it as stdout; on a non-zero exit also mirror
    // it into stderr so error-classifying callers still see the message.
    const out = res.result ?? '';
    const exitCode = res.exitCode ?? 0;
    opts?.onStdout?.(out);
    const stderr = exitCode === 0 ? '' : out;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    this.log(exitCode === 0 ? 'info' : 'error', `exec exit ${exitCode} (${secs}s): ${cmd}`);
    return { exitCode, stdout: out.trim(), stderr: stderr.trim() };
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    if (!files.length) return;
    const uploads = files.map((f) => ({
      source: Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content),
      destination: underWorkdir(f.path),
    }));
    await this.sandbox.fs.uploadFiles(uploads);
    if (files.length === 1) this.log('info', `wrote file ${files[0]!.path}`);
    else this.log('info', `wrote ${files.length} files`);
  }

  async readFile(filePath: string): Promise<Buffer | null> {
    try {
      // The single-arg overload returns the file content as a Buffer.
      const buf = await this.sandbox.fs.downloadFile(underWorkdir(filePath));
      return buf;
    } catch {
      return null;
    }
  }

  async exposePort(port: number): Promise<{ url: string; token?: string }> {
    // Return a self-contained signed URL so browser/manual eval can open the
    // preview without custom headers. Header-token previews are still available
    // through getPreviewLink, but the common EnvironmentHandle contract promises
    // a finished URL.
    const signed = await this.sandbox.getSignedPreviewUrl(port, 3600);
    this.log('info', `port ${port} exposed → ${signed.url}`);
    return { url: signed.url };
  }

  // Family-private extension (NOT on the opaque EnvironmentHandle): a
  // self-contained signed preview URL with the token baked in and a TTL — hand
  // it straight to a browser, no header needed. A same-family caller can narrow
  // to DaytonaPreviewHandle to reach it; the kernel/registry/types never do, so
  // the opaqueness rule (and the grep gate) hold.
  async exposeSignedPort(port: number, ttlSeconds = 3600): Promise<{ url: string }> {
    const signed = await this.sandbox.getSignedPreviewUrl(port, ttlSeconds);
    this.log('info', `port ${port} exposed (signed, ${ttlSeconds}s) → ${signed.url}`);
    return { url: signed.url };
  }

  async waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // Portable in-sandbox readiness probe: node is present on the node
      // runtime image; no bash-isms, no extra package. Mirrors the docker
      // adapter's probe but runs through executeCommand.
      const r = await this.exec(
        `node -e 'require("net").connect(${port},"127.0.0.1").on("connect",()=>{console.log("open");process.exit(0)}).on("error",()=>{console.log("closed");process.exit(0)})'`
      );
      if (!('poll' in r) && r.stdout.includes('open')) return;
      await new Promise((res) => setTimeout(res, 1000));
    }
    throw new Error(`waitForPort(${port}) timed out`);
  }

  async destroy(): Promise<void> {
    this.log('info', `tearing down sandbox ${this.id}`);
    await this.sandbox.delete().catch(() => {});
    this.log('info', 'sandbox deleted');
  }
}

// The family-private narrowing contract: lets a same-family caller reach the
// signed-URL extension without crossing into kernel/registry/types. Same pattern
// as the local adapter's LocalWorkspaceHandle.
export interface DaytonaPreviewHandle extends EnvironmentHandle {
  readonly kind: 'daytona';
  exposeSignedPort(port: number, ttlSeconds?: number): Promise<{ url: string }>;
}

export function isDaytonaPreviewHandle(h: EnvironmentHandle): h is DaytonaPreviewHandle {
  return (h as Partial<DaytonaPreviewHandle>).kind === 'daytona';
}

class DaytonaEnvironment implements Environment {
  readonly ref = 'daytona';
  readonly capabilities = CAPS;

  async provision(spec: ProvisionSpec): Promise<EnvironmentHandle> {
    const log = spec.logger ?? noopLog;

    // DAYTONA_API_KEY is the expected BLOCKER. The SDK also reads it from the
    // env directly, but we surface a clear error here so the failure is the
    // adapter's, not a deep SDK stack trace.
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
      throw new Error(
        'daytona: DAYTONA_API_KEY is not set. Get a key at https://app.daytona.io and export DAYTONA_API_KEY before provisioning a daytona environment.'
      );
    }

    log('info', 'provisioning env (daytona cloud sandbox)');
    const daytona = new Daytona({ apiKey });

    // create() accepts language/image/env/labels/resources. We pass env vars and
    // labels declaratively; the snapshot/image default gives a general Linux
    // runtime with node available (runtimeProfile maps to a custom image when set).
    let sandbox: Sandbox;
    try {
      sandbox = await daytona.create({
        user: process.env.DAYTONA_USER || DEFAULT_USER,
        ...(spec.runtimeProfile ? { snapshot: spec.runtimeProfile } : {}),
        envVars: shellEnv(spec.env),
        ...lifecyclePolicy(),
        labels: { 'modular-runner': 'true', ...(spec.labels ?? {}) },
      });
    } catch (err) {
      throw explainProvisionError(err);
    }
    log('info', `sandbox created ${sandbox.id}`);

    const handle = new DaytonaHandle(sandbox.id, sandbox, log);
    try {
      await sandbox.fs.createFolder(WORKDIR, '755').catch(() => {});
      await this.materialize(sandbox, handle, spec.source, log);
    } catch (err) {
      await sandbox.delete().catch(() => {});
      throw explainProvisionError(err);
    }
    log('info', 'workspace materialized');
    return handle;
  }

  private async materialize(
    sandbox: Sandbox,
    handle: DaytonaHandle,
    source: ProvisionSource,
    log: EnvLogger
  ): Promise<void> {
    if (source.kind === 'files') {
      if (source.files.length) await handle.writeFiles(source.files);
    } else if (source.kind === 'git') {
      // NATIVE git — Daytona's strongest built-in. No clone-inside via exec.
      // Token (if any) authenticates as the git password with a placeholder
      // username, the standard pattern for token-based HTTPS clone.
      log('info', `cloning ${source.url} (native git) → ${WORKDIR}`);
      await sandbox.git.clone(
        source.url,
        WORKDIR,
        source.revision, // branch
        undefined, // commitId
        source.token ? 'x-access-token' : undefined,
        source.token
      );
    } else {
      // kind === 'cache' — no snapshot/cache wiring for the MVP daytona path.
      throw new Error(`daytona: source.kind "cache" is not supported in the MVP adapter`);
    }
  }
}

registerEnvironment('daytona', () => new DaytonaEnvironment());

// Re-exported so the verify script and same-family callers can construct the
// adapter directly without going through the registry.
export { DaytonaEnvironment, DaytonaHandle };
