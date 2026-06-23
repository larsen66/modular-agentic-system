// src/harnesses/pi/envTools.ts
// The `agent-as-tool` wiring for the PI harness: PI's agent loop runs on the
// control plane, but its read/bash/edit/write tools execute INSIDE the opaque
// EnvironmentHandle instead of on the host. This is exactly what pi's tool
// Operations abstraction is for — the SDK docstring on BashOperations says:
// "Override these to delegate command execution to remote systems (for example SSH)."
//
// PI computes absolute paths from its cwd (a host scratch dir used only for pi's
// own housekeeping). We map those back to env-relative paths so the env adapter
// resolves them against its OWN (opaque) workspace root. The kernel never learns
// the env's real root — we only ever hand it relative paths.

import path from 'node:path';
import type { EnvironmentHandle, ExecResult } from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';

// Map a host-absolute path (under pi's scratch cwd) → an env-relative path the
// EnvironmentHandle resolves against its own root. Paths that escape the scratch
// root collapse to their basename so a stray tool call can't reach the host FS.
function toEnvPath(scratchRoot: string, absolutePath: string): string {
  const rel = path.relative(scratchRoot, absolutePath);
  if (!rel || rel === '') return '.';
  return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}

// The four pi tool-definition factories we route. Typed loosely (the package
// ships its own types but is dynamically imported, like in index.ts).
export interface PiToolDefFactories {
  createBashToolDefinition: (cwd: string, opts?: unknown) => unknown;
  createReadToolDefinition: (cwd: string, opts?: unknown) => unknown;
  createWriteToolDefinition: (cwd: string, opts?: unknown) => unknown;
  createEditToolDefinition: (cwd: string, opts?: unknown) => unknown;
}

// Build the 4 coding-tool DEFINITIONS (pass as createAgentSession `customTools`)
// whose Operations route every call into `env`. No host execution happens.
export function buildEnvRoutedToolDefinitions(
  sdk: PiToolDefFactories,
  env: EnvironmentHandle,
  scratchRoot: string,
): unknown[] {
  const readFile = async (absolutePath: string): Promise<Buffer> => {
    const buf = await env.readFile(toEnvPath(scratchRoot, absolutePath));
    if (buf === null) throw new Error(`ENOENT: no such file in env: ${absolutePath}`);
    return buf;
  };
  const access = async (absolutePath: string): Promise<void> => {
    await readFile(absolutePath); // throws if the file isn't present in the env
  };
  const writeFile = async (absolutePath: string, content: string): Promise<void> => {
    await env.writeFiles([{ path: toEnvPath(scratchRoot, absolutePath), content }]);
  };
  // env.writeFiles already creates parent dirs; mkdir handles explicit empty dirs.
  const mkdir = async (dir: string): Promise<void> => {
    await env.exec(`mkdir -p ${JSON.stringify(toEnvPath(scratchRoot, dir))}`);
  };

  const bashOps = {
    exec: async (
      command: string,
      cwd: string,
      options: { onData: (data: Buffer) => void; signal?: AbortSignal; timeout?: number },
    ): Promise<{ exitCode: number | null }> => {
      const res = await env.exec(command, {
        cwd: toEnvPath(scratchRoot, cwd),
        timeoutMs: options.timeout,
        onStdout: (c) => options.onData(Buffer.from(c)),
        onStderr: (c) => options.onData(Buffer.from(c)),
      });
      // agent-as-tool runs blocking commands → ExecResult. If an adapter hands
      // back a ProcessHandle (detached), wait for it so pi gets an exit code.
      if (isProcessHandle(res)) return { exitCode: await res.wait() };
      return { exitCode: (res as ExecResult).exitCode };
    },
  };
  const readOps = { readFile, access };
  const writeOps = { writeFile, mkdir };
  const editOps = { readFile, writeFile, access };

  return [
    sdk.createBashToolDefinition(scratchRoot, { operations: bashOps }),
    sdk.createReadToolDefinition(scratchRoot, { operations: readOps }),
    sdk.createWriteToolDefinition(scratchRoot, { operations: writeOps }),
    sdk.createEditToolDefinition(scratchRoot, { operations: editOps }),
  ];
}
