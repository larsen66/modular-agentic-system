// src/types/environment.ts
// Declarative: Core hands a spec, gets back an opaque handle. Core never learns
// HOW (container? microVM? which SDK?) — only the capabilities it may call.
// Verbatim from SPEC §1.1.

// A substrate-agnostic diagnostics sink. The kernel passes its own emit function
// here so an env adapter can narrate its lifecycle (provision/exec/file-sync/
// exposePort/destroy) into the EngineEvent stream — WITHOUT the kernel learning
// any substrate detail. It's just a callback; the kernel stays grep-clean.
export type EnvLogger = (level: 'info' | 'warn' | 'error', message: string) => void;

export type ProvisionSource =
  | { kind: 'git'; url: string; revision?: string; depth?: number; token?: string }
  | { kind: 'files'; files: { path: string; content: string }[] }
  | { kind: 'cache'; ref: string };

export interface ProvisionSpec {
  source: ProvisionSource;
  runtimeProfile?: string; // image / template / runtime id (e.g. 'node20')
  env?: Record<string, string>; // resolved env vars + secrets (injected by the adapter)
  ports?: number[]; // declared up-front (Modal/Vercel require this)
  resources?: { cpu?: number; memMb?: number };
  labels?: Record<string, string>;
  logger?: EnvLogger; // optional lifecycle narration sink (UI Activity Log)
}

export interface ExecOpts {
  cwd?: string; // EXPLICIT param — never a heredoc/marker side-channel
  env?: Record<string, string>;
  detached?: boolean; // long-running process (dev server)
  timeoutMs?: number; // declarative policy, not embedded in the cmd string
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessHandle {
  readonly pid?: number;
  poll(): Promise<number | null>; // exit code or null if still running
  wait(): Promise<number>;
  kill(signal?: string): Promise<void>;
}

export interface EnvironmentCapabilities {
  publicPorts: boolean; // exposePort returns a real public URL
  pty: boolean; // interactive terminal supported
  snapshot: boolean; // snapshot()/restore() implemented
  nativeGit: boolean; // git seed via source spec (vs clone-inside)
  fileWatch: boolean; // push-based change events
  persistentVolume: boolean;
  // Can this env host an agent RUNTIME inside itself — i.e. spawn a long-lived
  // detached process AND expose its port (or hand a host workspace dir)? This is
  // the gate for the 'agent-in-sandbox' topology. 'agent-as-tool' needs only
  // exec() and is supported by every env regardless of this flag.
  hostsAgentRuntime: boolean;
}

export interface EnvironmentHandle {
  // OPAQUE to Core — the whole point of the design.
  readonly id: string; // adapter-internal; Core treats it as opaque
  readonly capabilities: EnvironmentCapabilities;

  exec(cmd: string, opts?: ExecOpts): Promise<ExecResult | ProcessHandle>;
  writeFiles(files: { path: string; content: string | Buffer }[]): Promise<void>;
  readFile(path: string): Promise<Buffer | null>;

  // THE differentiating capability — returns a FULL url string; the proxy is
  // hidden inside the adapter.
  exposePort(port: number, opts?: { public?: boolean }): Promise<{ url: string; token?: string }>;
  waitForPort?(port: number, timeoutMs?: number): Promise<void>;

  // optional, capability-gated
  snapshot?(): Promise<string>; // returns a snapshotRef
  destroy(): Promise<void>;
}

export interface Environment {
  // the adapter (registry value)
  readonly ref: string; // 'docker' | 'e2b' | 'local' …
  readonly capabilities: EnvironmentCapabilities; // advertised before provision
  provision(spec: ProvisionSpec): Promise<EnvironmentHandle>;
  restore?(snapshotRef: string): Promise<EnvironmentHandle>;
}

// Narrowing helper used by harnesses to discriminate ExecResult | ProcessHandle
// without referencing any substrate type. (Lives in contracts; substrate-free.)
export function isProcessHandle(r: ExecResult | ProcessHandle): r is ProcessHandle {
  return typeof (r as ProcessHandle).poll === 'function';
}
