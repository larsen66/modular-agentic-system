// src/harnesses/claude-agent-sdk/tools.ts
// The 4 sandbox tools the model is given, built as IN-PROCESS Agent SDK MCP tools
// (`createSdkMcpServer` + `tool`). Their handlers run in OUR control-plane process
// — where we hold the opaque EnvironmentHandle — so every file write / shell
// command / port exposure executes in OUR sandbox via the handle, never on the
// harness's local disk. This is what keeps the env seam intact while the Agent
// SDK owns the agent loop: we DENY the built-in Read/Write/Bash/Edit tools and
// allow ONLY these four (see index.ts allowedTools + canUseTool).
//
// Tool shapes + dispatch behaviour are kept identical to the provider-agnostic
// `sdk` harness so the adapters stay swap-equal; only the registration surface
// (Agent SDK MCP vs raw Anthropic `tools`) differs.

import { z } from 'zod';
import type { EnvironmentHandle, RunIO } from '../../types/index.js';
import { isProcessHandle } from '../../types/index.js';
import type { AgentSdkModule } from './client.js';

// MCP server name → tools are exposed to the model as `mcp__<SERVER>__<tool>`.
export const SANDBOX_SERVER = 'sandbox';

// The fully-qualified tool names the model sees. allowedTools / canUseTool gate
// on exactly these — anything else (built-in Read/Write/Bash/…) is denied.
export const SANDBOX_TOOL_NAMES = [
  `mcp__${SANDBOX_SERVER}__write_file`,
  `mcp__${SANDBOX_SERVER}__run_command`,
  `mcp__${SANDBOX_SERVER}__read_file`,
  `mcp__${SANDBOX_SERVER}__expose_port`,
];

export const SYSTEM = `You are a senior full-stack engineer working inside a fresh sandbox workspace.
Your job: take the user's request and produce a REAL, runnable web app, then start its dev server and expose it so the user sees a live preview.

Rules:
- Build a Vite + React app (JavaScript) unless the user clearly asks otherwise. Keep it minimal but real and working.
- Use the provided tools (write_file, run_command, read_file, expose_port) to actually create files, install dependencies, and start the dev server. Do not just describe steps — perform them.
- Do NOT attempt to use Bash, Read, Write, or Edit directly; only the four sandbox tools above operate on the workspace. Other tools are disabled.
- A typical flow: write_file package.json, vite.config, index.html, src/main.jsx, src/App.jsx → run_command "npm install" → start the dev server in the background bound to 0.0.0.0 → expose_port with the dev server port.
- The dev server MUST listen on 0.0.0.0 (not just localhost) and on the port you will expose. For Vite use: npm run dev -- --host 0.0.0.0 --port 5173
- When the app is running and the port is exposed, give a one-paragraph summary and stop.
Be concise in your text; let the tools do the work.`;

// A text-only CallToolResult, the shape the Agent SDK `tool()` handler must return.
function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], isError };
}

// Build the in-process MCP server carrying the 4 sandbox tools. Each handler emits
// the matching EngineEvents (tool_call → tool_result / preview_ready) — this is the
// SINGLE place those events originate, so index.ts must NOT also emit tool_call for
// assistant tool_use blocks (that would double-count). `extra.toolUseId` is the SDK
// callId when present; we fall back to a synthetic id so events always correlate.
export function buildSandboxServer(sdk: AgentSdkModule, env: EnvironmentHandle, io: RunIO) {
  const { tool, createSdkMcpServer } = sdk;

  let seq = 0;
  const callId = (extra: unknown): string => {
    const id = (extra as { toolUseId?: string } | undefined)?.toolUseId;
    return id ?? `sandbox-${++seq}`;
  };

  const writeFile = tool(
    'write_file',
    'Create or overwrite a file in the project workspace. Use relative paths (e.g. "src/App.jsx").',
    { path: z.string().describe('Relative file path within the workspace.'), content: z.string().describe('Full file contents.') },
    async (args: { path: string; content: string }, extra: unknown) => {
      const id = callId(extra);
      io.emit({ type: 'tool_call', name: 'write_file', args, callId: id });
      try {
        await env.writeFiles([{ path: args.path, content: args.content }]);
        io.emit({ type: 'tool_result', ok: true, output: `wrote ${args.path}`, callId: id });
        return textResult(`wrote ${args.path} (${args.content.length} bytes)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        io.emit({ type: 'tool_result', ok: false, output: message.slice(0, 800), callId: id });
        return textResult(`tool error: ${message}`, true);
      }
    }
  );

  const runCommand = tool(
    'run_command',
    'Run a shell command in the workspace (e.g. "npm install", "npm run build"). ' +
      'For a long-running dev server, set background:true so it does not block. ' +
      'Returns stdout/stderr/exitCode for foreground commands.',
    { cmd: z.string().describe('The shell command to run.'), background: z.boolean().optional().describe('Run detached (use for dev servers). Default false.') },
    async (args: { cmd: string; background?: boolean }, extra: unknown) => {
      const id = callId(extra);
      io.emit({ type: 'tool_call', name: 'run_command', args, callId: id });
      try {
        const r = await env.exec(args.cmd, { detached: Boolean(args.background), timeoutMs: 240_000 });
        if (isProcessHandle(r)) {
          io.emit({ type: 'tool_result', ok: true, output: `[started] ${args.cmd}`, callId: id });
          return textResult(`started in background: ${args.cmd}`);
        }
        const ok = r.exitCode === 0;
        const out = (r.stdout + (r.stderr ? `\n[stderr]\n${r.stderr}` : '')).slice(-4000);
        io.emit({ type: 'tool_result', ok, output: out.slice(0, 800), callId: id });
        return textResult(`exitCode=${r.exitCode}\n${out}`, !ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        io.emit({ type: 'tool_result', ok: false, output: message.slice(0, 800), callId: id });
        return textResult(`tool error: ${message}`, true);
      }
    }
  );

  const readFile = tool(
    'read_file',
    'Read a file from the workspace. Returns its contents or an empty string.',
    { path: z.string() },
    async (args: { path: string }, extra: unknown) => {
      const id = callId(extra);
      io.emit({ type: 'tool_call', name: 'read_file', args, callId: id });
      try {
        const buf = await env.readFile(args.path);
        const content = buf ? buf.toString('utf8') : '';
        io.emit({ type: 'tool_result', ok: true, output: `read ${args.path}`, callId: id });
        return textResult(content || '(empty or not found)');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        io.emit({ type: 'tool_result', ok: false, output: message.slice(0, 800), callId: id });
        return textResult(`tool error: ${message}`, true);
      }
    }
  );

  const exposePort = tool(
    'expose_port',
    'Expose a port the running dev server listens on and get back a public preview URL. ' +
      'Call this AFTER the dev server is started so the user can see the live app.',
    { port: z.number().describe('The port the dev server listens on.') },
    async (args: { port: number }, extra: unknown) => {
      const id = callId(extra);
      io.emit({ type: 'tool_call', name: 'expose_port', args, callId: id });
      try {
        await env.waitForPort?.(args.port, 60_000);
        const { url } = await env.exposePort(args.port);
        io.emit({ type: 'preview_ready', url, port: args.port });
        io.emit({ type: 'tool_result', ok: true, output: url, callId: id });
        return textResult(`Preview URL: ${url}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        io.emit({ type: 'tool_result', ok: false, output: message.slice(0, 800), callId: id });
        return textResult(`tool error: ${message}`, true);
      }
    }
  );

  const server = createSdkMcpServer({
    name: SANDBOX_SERVER,
    version: '1.0.0',
    tools: [writeFile, runCommand, readFile, exposePort],
  });

  return { server, toolNames: SANDBOX_TOOL_NAMES };
}
