// src/harnesses/openai-agents/tools.ts
// Builds the real @openai/agents function tools. Each tool is created via the
// SDK's `tool()` factory and delegates to the shared `executeTool` authority that
// routes out to the opaque EnvironmentHandle.
//
// Parameters are declared as strict plain JSON Schema, so we avoid a Zod
// dependency while still matching the SDK's typed tool contract.

import type { EnvironmentHandle, RunIO } from '../../types/index.js';
import { executeTool, TOOL_SCHEMAS, TOOL_DESCRIPTIONS, type ToolName } from './execEngine.js';

import type { FunctionTool, tool as createTool } from '@openai/agents';

export type AgentsToolFactory = typeof createTool;
export type EnvTool = FunctionTool<unknown, StrictToolSchema, unknown>;
type StrictToolSchema = {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  additionalProperties: false;
};

const ORDER: ToolName[] = ['write_file', 'run_command', 'read_file', 'expose_port'];

/**
 * Build the four execution tools bound to THIS run's env + io, using the real
 * SDK `tool()` factory. Returns an array of SDK Tool objects (typed `unknown[]`
 * structurally; the SDK consumes them as `Tool[]`).
 */
export function buildEnvTools(
  toolFactory: AgentsToolFactory,
  env: EnvironmentHandle,
  io: RunIO
): EnvTool[] {
  return ORDER.map((name) =>
    toolFactory({
      name,
      description: TOOL_DESCRIPTIONS[name],
      parameters: TOOL_SCHEMAS[name] as StrictToolSchema,
      strict: true,
      // The SDK passes the parsed arguments object as the first arg for
      // JSON-schema tools. Delegate to the shared execution authority.
      execute: async (input: unknown): Promise<string> => executeTool(name, input, env, io),
    })
  );
}
