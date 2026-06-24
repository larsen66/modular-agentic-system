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

import type { RunContext, RunIO } from '../../types/index.js';
// All model-facing routing prose lives in routerPolicy.ts — the single tunable
// knob the accuracy auto-fix loop edits. This file owns only the SDK plumbing.
import {
  renderDelegateDescription,
  HARNESS_PARAM_DESC,
  ENVIRONMENT_PARAM_DESC,
  TASK_PARAM_DESC,
  MODEL_PARAM_DESC,
  TOPOLOGY_FIELD_DESCRIPTION,
} from './routerPolicy.js';

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
  // Constrain harness/environment to the LIVE catalog refs (and topology to the
  // two real values) as TypeBox enums. The model then physically cannot invent a
  // ref like "python" — the same structural-enforcement move as the read+delegate
  // toolset: validity is a property of the schema, not a hope about the prompt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enumOf = (refs: string[], desc: string): any => {
    if (refs.length === 0) return Type.String({ description: desc });
    if (refs.length === 1) return Type.Literal(refs[0], { description: desc });
    return Type.Union(refs.map((r) => Type.Literal(r)), { description: desc });
  };
  const harnessSchema = enumOf(
    ctx.catalog.harnesses.map((h) => h.ref),
    HARNESS_PARAM_DESC,
  );
  const environmentSchema = enumOf(
    ctx.catalog.environments.map((e) => e.ref),
    ENVIRONMENT_PARAM_DESC,
  );

  return defineTool({
    name: 'delegate',
    label: 'Delegate to sub-agent',
    description: renderDelegateDescription(ctx.catalog),
    promptSnippet: 'delegate — run a sub-task on another harness/environment and return its result.',
    parameters: Type.Object({
      harness: harnessSchema,
      environment: environmentSchema,
      task: Type.String({ description: TASK_PARAM_DESC }),
      topology: Type.Optional(
        Type.Union([Type.Literal('agent-as-tool'), Type.Literal('agent-in-sandbox')], {
          description: TOPOLOGY_FIELD_DESCRIPTION,
        }),
      ),
      model: Type.Optional(Type.String({ description: MODEL_PARAM_DESC })),
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
