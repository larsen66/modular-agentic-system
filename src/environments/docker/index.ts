// src/environments/docker/index.ts
// The Docker environment adapter — the ONLY place dockerode / container_id /
// hostPort are allowed to appear (legacy rule R6). It satisfies the SAME opaque
// EnvironmentHandle contract the dummy env does; Core can swap dummy <-> docker
// by a ref-string change and never learns there is a container behind the handle.

import Docker from 'dockerode';
import type { Container } from 'dockerode';
import tar from 'tar-stream';
import { Readable } from 'node:stream';
import path from 'node:path';
import { registerEnvironment } from '../../registry/index.js';
import type {
  Environment,
  EnvironmentCapabilities,
  EnvironmentHandle,
  EnvLogger,
  ExecOpts,
  ExecResult,
  ProvisionSpec,
} from '../../types/index.js';
import { DockerPreviewProxy } from './proxy.js';

const CAPS: EnvironmentCapabilities = {
  publicPorts: true, // via the written-once reverse proxy
  pty: false,
  snapshot: false,
  nativeGit: false, // MVP: clone-inside via exec when source.kind === 'git'
  fileWatch: false,
  persistentVolume: false,
  hostsAgentRuntime: true, // detached exec + reverse-proxy exposePort → agent-in-sandbox OK
};

const WORKDIR = '/workspace';

function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

const noopLog: EnvLogger = () => {};

class DockerHandle implements EnvironmentHandle {
  readonly capabilities = CAPS;

  constructor(
    readonly id: string, // container id — opaque to Core, lives only here
    private readonly container: Container,
    private readonly proxy: DockerPreviewProxy,
    private readonly log: EnvLogger = noopLog // narrates substrate lifecycle to the UI
  ) {}

  async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult> {
    const env = opts?.env
      ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`)
      : undefined;
    const exec = await this.container.exec({
      // /bin/sh exists on both Alpine (busybox) and Debian images; bash may not.
      // The exec contract is "run what the runtime understands", so the adapter
      // picks the shell — Core never specifies one.
      Cmd: ['/bin/sh', '-c', cmd],
      WorkingDir: opts?.cwd ?? WORKDIR,
      Env: env,
      AttachStdout: true,
      AttachStderr: true,
    });

    if (opts?.detached) {
      // A bare `docker exec --detach` process is unreliable — it can be reaped
      // when the exec session ends, killing a dev server. Instead wrap the
      // command in `nohup … &` with output to a log file so it is reparented to
      // PID 1 and survives. We replace the exec we just built with a wrapped one.
      this.log('info', `dev server starting (background): ${cmd}`);
      const logFile = `/tmp/devproc-${Date.now()}.log`;
      const wrapped = await this.container.exec({
        Cmd: ['/bin/sh', '-c', `nohup ${cmd} > ${logFile} 2>&1 &`],
        WorkingDir: opts?.cwd ?? WORKDIR,
        Env: env,
        AttachStdout: false,
        AttachStderr: false,
      });
      await wrapped.start({ Detach: true });
      return { exitCode: 0, stdout: logFile, stderr: '' };
    }

    this.log('info', `exec: ${cmd}`);
    const startedAt = Date.now();

    const stream = await exec.start({ hijack: true, stdin: false });
    let stdout = '';
    let stderr = '';
    await new Promise<void>((resolve, reject) => {
      // demuxStream splits Docker's multiplexed stdout/stderr frames.
      this.container.modem.demuxStream(
        stream,
        {
          write: (c: Buffer) => {
            const s = c.toString('utf8');
            stdout += s;
            opts?.onStdout?.(s);
            return true;
          },
        } as NodeJS.WritableStream,
        {
          write: (c: Buffer) => {
            const s = c.toString('utf8');
            stderr += s;
            opts?.onStderr?.(s);
            return true;
          },
        } as NodeJS.WritableStream
      );
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const info = await exec.inspect();
    const code = info.ExitCode ?? 0;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    this.log(code === 0 ? 'info' : 'error', `exec exit ${code} (${secs}s): ${cmd}`);
    return { exitCode: code, stdout: stdout.trim(), stderr: stderr.trim() };
  }

  async writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void> {
    const pack = tar.pack();
    for (const f of files) {
      // Resolve relative paths against WORKDIR (same base readFile uses), then
      // strip the leading slash so the tar extracts to the right absolute path
      // when unpacked at '/'. Keeps write/read symmetric.
      const abs = f.path.startsWith('/') ? f.path : path.posix.join(WORKDIR, f.path);
      const rel = abs.slice(1);
      pack.entry({ name: rel }, Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content));
    }
    pack.finalize();
    // put_archive extracts the tar at the given path inside the container.
    await this.container.putArchive(pack as unknown as Readable, { path: '/' });
    if (files.length === 1) this.log('info', `wrote file ${files[0]!.path}`);
    else if (files.length > 1) this.log('info', `wrote ${files.length} files`);
  }

  async readFile(filePath: string): Promise<Buffer | null> {
    try {
      const abs = filePath.startsWith('/') ? filePath : path.posix.join(WORKDIR, filePath);
      const stream = await this.container.getArchive({ path: abs });
      const tarBuf = await collectStream(stream as unknown as NodeJS.ReadableStream);
      return await extractSingleFile(tarBuf);
    } catch {
      return null;
    }
  }

  async exposePort(port: number): Promise<{ url: string }> {
    // Find the host port Docker published for the container's port, then run the
    // written-once reverse proxy against it. Core never sees the host port.
    const info = await this.container.inspect();
    const bindings = info.NetworkSettings.Ports?.[`${port}/tcp`];
    const hostPort = bindings?.[0]?.HostPort;
    if (!hostPort) {
      this.log('error', `cannot expose port ${port}: not published at container create time`);
      throw new Error(`port ${port} was not published at container create time`);
    }
    const result = await this.proxy.expose('127.0.0.1', Number(hostPort));
    this.log('info', `port ${port} exposed → ${result.url}`);
    return result;
  }

  async waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // Portable readiness probe: prefer `nc` (present on Alpine busybox), fall
      // back to a node one-liner (node images always have node). No bash-isms.
      const r = await this.exec(
        `nc -z 127.0.0.1 ${port} && echo open || ` +
          `node -e 'require("net").connect(${port},"127.0.0.1").on("connect",()=>{console.log("open");process.exit(0)}).on("error",()=>{console.log("closed");process.exit(0)})'`
      );
      if (r.stdout.includes('open')) return;
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error(`waitForPort(${port}) timed out`);
  }

  async destroy(): Promise<void> {
    this.log('info', `tearing down container ${this.id.slice(0, 12)}`);
    await this.proxy.destroy().catch(() => {});
    await this.container.stop({ t: 1 }).catch(() => {});
    await this.container.remove({ force: true }).catch(() => {});
    this.log('info', 'container removed');
  }
}

class DockerEnvironment implements Environment {
  readonly ref = 'docker';
  readonly capabilities = CAPS;
  private docker = new Docker();

  async provision(spec: ProvisionSpec): Promise<EnvironmentHandle> {
    const log = spec.logger ?? noopLog;
    // Default to a Debian-based image (node:20-slim) so npm/Vite "just work".
    const image = spec.runtimeProfile ?? 'node:20-slim';
    log('info', `provisioning env (docker ${image})`);
    await this.ensureImage(image, log);

    // Docker requires port publishing at CREATE time. The caller may not know
    // which port the agent's dev server will pick, so when no ports are declared
    // we publish a set of common dev-server ports. exposePort then maps whichever
    // one the agent actually used. (Declared ports are merged in too.)
    const COMMON_DEV_PORTS = [5173, 3000, 8080, 4321, 4173];
    const ports = Array.from(new Set([...(spec.ports ?? []), ...COMMON_DEV_PORTS]));

    const exposedPorts: Record<string, {}> = {};
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    for (const p of ports) {
      exposedPorts[`${p}/tcp`] = {};
      portBindings[`${p}/tcp`] = [{ HostPort: '' }]; // '' = random free host port
    }

    const env = spec.env
      ? Object.entries(spec.env).map(([k, v]) => `${k}=${v}`)
      : undefined;

    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ['sh', '-c', 'mkdir -p /workspace && tail -f /dev/null'],
      WorkingDir: WORKDIR,
      Env: env,
      ExposedPorts: exposedPorts,
      HostConfig: { PortBindings: portBindings, AutoRemove: false },
      Labels: { 'modular-runner': 'true', ...(spec.labels ?? {}) },
    });
    log('info', `container created ${container.id.slice(0, 12)}`);
    await container.start();
    log('info', 'container started');

    const proxy = new DockerPreviewProxy();
    const handle = new DockerHandle(container.id, container, proxy, log);

    // Materialize the workspace from the declarative source spec.
    await this.materialize(handle, spec);
    log('info', 'workspace materialized');
    return handle;
  }

  private async materialize(handle: DockerHandle, spec: ProvisionSpec): Promise<void> {
    if (spec.source.kind === 'files') {
      // writeFiles already resolves relative paths against WORKDIR — pass raw.
      if (spec.source.files.length) await handle.writeFiles(spec.source.files);
    } else if (spec.source.kind === 'git') {
      // No native git capability → clone-inside via exec (the kernel's fallback
      // ladder lands here when nativeGit is false).
      const token = spec.source.token ? `${spec.source.token}@` : '';
      const url = spec.source.url.replace('https://', `https://${token}`);
      await handle.exec(`git clone --depth ${spec.source.depth ?? 1} ${url} ${WORKDIR}`);
    }
  }

  private async ensureImage(image: string, log: EnvLogger = noopLog): Promise<void> {
    const images = await this.docker.listImages();
    const have = images.some((i) => (i.RepoTags ?? []).includes(image));
    if (have) {
      log('info', `image ${image} present`);
      return;
    }
    log('info', `pulling image ${image} (first run, may take a minute)`);
    await new Promise<void>((resolve, reject) => {
      this.docker.pull(image, (err: unknown, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        this.docker.modem.followProgress(stream, (e: unknown) => (e ? reject(e) : resolve()));
      });
    });
    log('info', `image ${image} pulled`);
  }
}

// Extract the first regular file's content from a tar buffer (Docker getArchive
// returns a tar even for a single file).
function extractSingleFile(tarBuf: Buffer): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    let result: Buffer | null = null;
    extract.on('entry', (header, stream, next) => {
      if (header.type === 'file' && result === null) {
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => {
          result = Buffer.concat(chunks);
          next();
        });
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    extract.on('finish', () => resolve(result));
    extract.on('error', reject);
    extract.end(tarBuf);
  });
}

registerEnvironment('docker', () => new DockerEnvironment());
