// src/environments/local/index.ts
// The LOCAL environment adapter — runs the workspace as a real directory on the
// HOST (a temp dir), execs via child_process, and serves the dev server directly
// from the host. It satisfies the SAME opaque EnvironmentHandle contract the
// dummy/docker envs do; Core can swap dummy <-> docker <-> local by a ref-string
// change and never learns there is a host directory + child process behind it.
//
// Why a host dir (not a container)? The CLI-credential harnesses (`claude-cli`,
// `codex-cli`) invoke the user's LOCAL `claude`/`codex` binaries, which already
// hold the user's login. Those binaries write files into THEIR cwd. The cleanest
// MVP wiring is: set the CLI's cwd to this env's host workspace dir, let it write
// the app, then run the dev server here and return its URL. No Docker, no
// auth-in-container plumbing, no secret copying.
//
// The host workspace path is a SUBSTRATE detail. It is NOT on the opaque
// EnvironmentHandle (Core must never see it). Instead a CLI-family harness can
// narrow the handle to LocalWorkspaceHandle (defined in this adapter layer) to
// learn its own cwd — a private contract between adapters in the same family,
// never crossing into kernel/registry/types.

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import { registerEnvironment } from '../../registry/index.js';
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
  publicPorts: true, // serves directly on a host port → http://localhost:<port>/
  pty: false,
  snapshot: false,
  nativeGit: false,
  fileWatch: false,
  persistentVolume: false,
  hostsAgentRuntime: true, // host workspace dir + detached child_process → agent-in-sandbox OK
};

const noopLog: EnvLogger = () => {};

// The family-private extension: a LocalHandle exposes its host workspace path so
// a same-family CLI harness can set the CLI's cwd to it. This interface lives in
// the adapter layer ONLY — it is never imported by kernel/registry/types, so the
// opaqueness rule (and the grep gate) hold.
export interface LocalWorkspaceHandle extends EnvironmentHandle {
  readonly kind: 'local';
  hostPath(): string;
}

export function isLocalWorkspaceHandle(h: EnvironmentHandle): h is LocalWorkspaceHandle {
  return (h as Partial<LocalWorkspaceHandle>).kind === 'local';
}

class LocalProcess implements ProcessHandle {
  constructor(private readonly child: ChildProcess) {}
  get pid(): number | undefined {
    return this.child.pid ?? undefined;
  }
  async poll(): Promise<number | null> {
    return this.child.exitCode;
  }
  wait(): Promise<number> {
    return new Promise((resolve) => this.child.on('exit', (code) => resolve(code ?? 0)));
  }
  async kill(signal?: string): Promise<void> {
    this.child.kill((signal as NodeJS.Signals) ?? 'SIGTERM');
  }
}

class LocalHandle implements LocalWorkspaceHandle {
  readonly capabilities = CAPS;
  readonly kind = 'local' as const;
  // Track detached children so destroy() can reap the dev server.
  private detached: ChildProcess[] = [];

  constructor(
    readonly id: string,
    private readonly root: string, // host workspace dir — SUBSTRATE, never leaves the adapter
    private readonly log: EnvLogger = noopLog
  ) {}

  hostPath(): string {
    return this.root;
  }

  private resolve(p: string): string {
    return isAbsolute(p) ? p : join(this.root, p);
  }

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle> {
    const cwd = opts?.cwd && isAbsolute(opts.cwd) ? opts.cwd : this.root;
    const env = { ...process.env, ...(opts?.env ?? {}) };

    if (opts?.detached) {
      this.log('info', `dev server starting (background): ${cmd}`);
      const child = spawn('/bin/sh', ['-c', cmd], {
        cwd,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (c: Buffer) => opts?.onStdout?.(c.toString('utf8')));
      child.stderr?.on('data', (c: Buffer) => opts?.onStderr?.(c.toString('utf8')));
      child.unref();
      this.detached.push(child);
      return new LocalProcess(child);
    }

    this.log('info', `exec: ${cmd}`);
    const startedAt = Date.now();
    return new Promise<ExecResult>((resolve) => {
      const child = spawn('/bin/sh', ['-c', cmd], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let killed = false;
      const timer = opts?.timeoutMs
        ? setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
          }, opts.timeoutMs)
        : null;
      child.stdout.on('data', (c: Buffer) => {
        const s = c.toString('utf8');
        stdout += s;
        opts?.onStdout?.(s);
      });
      child.stderr.on('data', (c: Buffer) => {
        const s = c.toString('utf8');
        stderr += s;
        opts?.onStderr?.(s);
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        const exitCode = killed ? 124 : code ?? 0;
        this.log(exitCode === 0 ? 'info' : 'error', `exec exit ${exitCode} (${secs}s): ${cmd}`);
        resolve({ exitCode, stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    for (const f of files) {
      const abs = this.resolve(f.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, f.content);
    }
    if (files.length === 1) this.log('info', `wrote file ${files[0]!.path}`);
    else if (files.length > 1) this.log('info', `wrote ${files.length} files`);
  }

  async readFile(path: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(path));
    } catch {
      return null;
    }
  }

  async exposePort(port: number): Promise<{ url: string }> {
    // The dev server runs directly on the host, so the port IS already reachable
    // at localhost. No proxy/host-port translation needed — Core gets a finished
    // URL string, exactly like every other adapter.
    const url = `http://localhost:${port}/`;
    this.log('info', `port ${port} exposed → ${url}`);
    return { url };
  }

  async waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const open = await new Promise<boolean>((resolve) => {
        const sock = net.connect(port, '127.0.0.1');
        sock.once('connect', () => {
          sock.destroy();
          resolve(true);
        });
        sock.once('error', () => resolve(false));
      });
      if (open) return;
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error(`waitForPort(${port}) timed out`);
  }

  async destroy(): Promise<void> {
    this.log('info', `tearing down local workspace ${this.id}`);
    for (const child of this.detached) {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM'); // kill the process group
      } catch {
        child.kill('SIGTERM');
      }
    }
    this.detached = [];
    await rm(this.root, { recursive: true, force: true }).catch(() => {});
    this.log('info', 'local workspace removed');
  }
}

class LocalEnvironment implements Environment {
  readonly ref = 'local';
  readonly capabilities = CAPS;

  async provision(spec: ProvisionSpec): Promise<EnvironmentHandle> {
    const log = spec.logger ?? noopLog;
    const root = await mkdtemp(join(tmpdir(), 'modular-local-'));
    log('info', `provisioning env (local ${root})`);
    const id = root.split('/').pop() ?? 'local';
    const handle = new LocalHandle(id, root, log);
    await this.materialize(handle, spec);
    log('info', 'workspace materialized');
    return handle;
  }

  private async materialize(handle: LocalHandle, spec: ProvisionSpec): Promise<void> {
    if (spec.source.kind === 'files' && spec.source.files.length) {
      await handle.writeFiles(spec.source.files);
    } else if (spec.source.kind === 'git') {
      const token = spec.source.token ? `${spec.source.token}@` : '';
      const url = spec.source.url.replace('https://', `https://${token}`);
      await handle.exec(`git clone --depth ${spec.source.depth ?? 1} ${url} .`);
    }
  }
}

registerEnvironment('local', () => new LocalEnvironment());
