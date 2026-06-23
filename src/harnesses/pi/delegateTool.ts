// src/harnesses/pi/delegateTool.ts
// The `delegate` tool — the mechanism that turns PI into the MAIN/router agent.
// PI calls delegate({ harness, environment, task }) to dispatch a sub-task to a
// DIFFERENT (harness, env, topology) triple. The handler re-enters the kernel
// via ctx.delegate (a Delegator), forwards the sub-run's streaming/usage/log
// events into PI's own io as NESTED progress, and returns the sub-agent's final
// text as the tool result PI then reasons over.
//
// Loosely typed (`any`) for the same reason index.ts is: @mariozechner/pi-coding-agent
// is a dynamically-imported optional dep, so defineTool / TypeBox `Type` arrive
// at runtime. The structural shape (name/label/description/parameters/execute)
// matches ToolDefinition in the SDK's dist types.

import type { HarnessEnvCatalog, RunContext, RunIO } from '../../types/index.js';

// Render the live catalog into a description block so the model routes against
// what ACTUALLY runs (never a hand-maintained list that can drift).
function renderCatalog(catalog: HarnessEnvCatalog): string {
  const harnesses = catalog.harnesses
    .map((h) => `  - harness "${h.ref}" — topologies: [${h.topologies.join(', ')}] (default: ${h.defaultTopology})`)
    .join('\n');
  const environments = catalog.environments
    .map((e) => `  - environment "${e.ref}" — hostsAgentRuntime: ${e.hostsAgentRuntime}`)
    .join('\n');
  return [
    'Dispatch a self-contained sub-task to a specialized sub-agent and wait for its result.',
    'Pick the harness + environment that best fit the task. Handle trivial asks YOURSELF —',
    'only delegate heavy or specialized work (builds, sandboxed execution, long agent loops).',
    '',
    'Available harnesses:',
    harnesses || '  (none)',
    '',
    'Available environments:',
    environments || '  (none)',
  ].join('\n');
}

// Build the pi ToolDefinition. `defineTool` + `Type` are the dynamically-imported
// SDK surfaces; `ctx` carries the Delegator; `io` is PI's event sink for nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDelegateToolDefinition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defineTool: (def: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Type: any,
  ctx: RunContext,
  io: RunIO,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return defineTool({
    name: 'delegate',
    label: 'Delegate to sub-agent',
    description: renderCatalog(ctx.catalog),
    promptSnippet: 'delegate — run a sub-task on another harness/environment and return its result.',
    parameters: Type.Object({
      harness: Type.String({ description: 'Harness ref to run the sub-task (from the catalog).' }),
      environment: Type.String({ description: 'Environment ref the sub-run executes in (from the catalog).' }),
      task: Type.String({ description: 'Self-contained instruction for the sub-agent.' }),
      topology: Type.Optional(
        Type.String({ description: "Optional: 'agent-as-tool' | 'agent-in-sandbox'. Omit for the harness default." }),
      ),
      model: Type.Optional(Type.String({ description: 'Optional model override for the sub-run.' })),
    }),
    async execute(
      _toolCallId: string,
      params: { harness: string; environment: string; task: string; topology?: string; model?: string },
      signal: AbortSignal | undefined,
    ) {
      const result = await ctx.delegate(
        {
          harness: params.harness,
          environment: params.environment,
          task: params.task,
          // The Delegator validates the topology against (harness, env); a bad
          // string settles the sub-run cleanly rather than throwing here.
          topology: params.topology as DelegateTopology,
          model: params.model,
        },
        (ev) => io.emit(ev), // nest the sub-run's progress under PI's stream
        signal ?? new AbortController().signal,
      );

      const text =
        result.cause === 'done'
          ? result.finalText || '(sub-agent finished with no text output)'
          : `Sub-agent ${result.cause}` +
            (result.error ? `: [${result.error.code}] ${result.error.message}` : '');

      return { content: [{ type: 'text', text }], details: result };
    },
  });
}

// Narrowing alias kept local — the param arrives as a free string from the model
// and the Delegator re-validates it, so we only assert the shape at the boundary.
type DelegateTopology = 'agent-as-tool' | 'agent-in-sandbox' | undefined;
