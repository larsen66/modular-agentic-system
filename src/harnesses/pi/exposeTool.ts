// src/harnesses/pi/exposeTool.ts
// The `expose_port` tool for PI (agent-as-tool only). PI's bash runs INSIDE the
// opaque EnvironmentHandle, so a server it backgrounds lives in the env; this
// tool maps a port on that env to a public preview URL via env.exposePort() and
// emits the `preview_ready` EngineEvent the kernel's preview registry + the
// frontend iframe bind to. Without it PI can build an app but never surface a
// live preview (no tool can reach env.exposePort from PI's own toolset).
//
// Loosely typed (`any`) for the same reason index.ts/delegateTool.ts are:
// @mariozechner/pi-coding-agent is a dynamically-imported optional dep, so
// defineTool / TypeBox `Type` arrive at runtime.

import type { EnvironmentHandle, RunIO } from '../../types/index.js';

// Build the pi ToolDefinition. `defineTool` + `Type` are the dynamically-imported
// SDK surfaces; `env` is the workspace handle; `io` is PI's event sink so the
// preview_ready it emits flows through the same pump the other harnesses use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildExposePortToolDefinition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defineTool: (def: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Type: any,
  env: EnvironmentHandle,
  io: RunIO,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return defineTool({
    name: 'expose_port',
    label: 'Expose a port (live preview)',
    description:
      'Expose a port your running server listens on inside the workspace and get back a ' +
      'public preview URL. Call this ONCE, AFTER you have started the server in the ' +
      'background (e.g. `python3 -m http.server <port> --bind 0.0.0.0 &` for a static site, ' +
      'or a dev server bound to 0.0.0.0). The server MUST listen on 0.0.0.0 (not just ' +
      'localhost) so the sandbox can route to it. The returned URL renders in the user’s ' +
      'live-preview iframe.',
    promptSnippet: 'expose_port — turn a running server port into a public preview URL.',
    parameters: Type.Object({
      port: Type.Number({ description: 'The port your server listens on (e.g. 5173).' }),
    }),
    async execute(_toolCallId: string, params: { port: number }) {
      const port = Number(params.port ?? 0);
      try {
        // Wait for the backgrounded server to actually accept connections before
        // exposing — otherwise the iframe loads a dead URL. waitForPort is optional
        // on the handle; skip the wait when an adapter doesn't implement it.
        await env.waitForPort?.(port, 60_000);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text',
              text:
                `Port ${port} never became ready: ${message}. Make sure the server is ` +
                `running in the BACKGROUND (command ends with \`&\`) and bound to 0.0.0.0 ` +
                `on this exact port, then call expose_port again.`,
            },
          ],
          isError: true,
        };
      }
      const { url } = await env.exposePort(port);
      // Semantic event owned by the tool — the orchestrator pump routes it into
      // the preview registry and forwards it to the frontend iframe.
      io.emit({ type: 'preview_ready', url, port });
      return { content: [{ type: 'text', text: `Preview URL: ${url}` }] };
    },
  });
}
