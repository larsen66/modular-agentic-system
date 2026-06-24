// src/types/tool.ts
// The THIRD seam: a provider-agnostic Tool. Mirrors the Environment seam — a
// portable spec the kernel resolves by ref, never knowing the provider's native
// tool shape. The portable layer (this file) owns name/description/JSON-schema +
// an execute body that routes OUT to the opaque EnvironmentHandle. The per-harness
// Adapter layer (inside each harness) renders a ToolSpec into the provider's
// native form (Anthropic input_schema / OpenAI parameters / SDK tool()).
//
// Why a seam: today write_file/run_command/read_file/expose_port are RE-DEFINED in
// claude-agent-sdk/tools.ts and openai-agents/execEngine.ts share identical
// env-routing bodies. One ToolSpec, many
// adapters collapses it.

import type { EnvironmentHandle } from './environment.js';
import type { RunIO } from './harness.js';
import type { SkillSpec } from './skill.js';

// Minimal JSON Schema for a tool's input. Provider-agnostic: each adapter feeds
// this verbatim to Anthropic `input_schema` / OpenAI `parameters`.
export interface ToolParameters {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  // JSON Schema is open-ended; this also makes a ToolParameters structurally a
  // Record<string, unknown> so adapters can hand it straight to a provider's
  // `input_schema` / `parameters` field without a cast.
  [key: string]: unknown;
}

// What the model sees back as the tool_result block. NEVER throws out of execute —
// tool failures are returned as `isError: true` text so the agent loop recovers.
export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface ToolSpec {
  readonly ref: string; // 'read' | 'write' | 'edit' | 'bash' | 'webfetch' …
  readonly description: string;
  readonly parameters: ToolParameters;
  // Diagnostics-only: true if execute MUST route through the EnvironmentHandle
  // (read/write/edit/bash/expose_port/browser); false for control-plane tools
  // (webfetch/websearch). The kernel does NOT branch on it.
  readonly needsEnv?: boolean;
  // The harness adapter emits the tool_call/tool_result correlation pair around
  // this call (it owns the provider call id). execute may emit SEMANTIC events
  // (e.g. preview_ready from expose_port) through io, but not the pair.
  execute(input: Record<string, unknown>, env: EnvironmentHandle, io: RunIO): Promise<ToolResult>;
}

// The bundle the kernel resolves PER RUN and hands to harness.run(). The harness
// renders `tools` into its native shape, dispatches via byRef, and composes its
// system prompt from `skills` via systemPreamble. This is the "any harness can,
// on request, get the tools+skills it needs" mechanism.
export interface ToolKit {
  // EXTERNAL specs the kernel provides — ONLY for refs the harness does not own
  // natively. byRef covers exactly these.
  readonly tools: ToolSpec[];
  readonly skills: SkillSpec[];
  // Requested refs the harness declared native (HarnessCapabilities.nativeTools/
  // nativeSkills ∩ requested). The harness renders + executes these ITSELF; the
  // kernel did NOT resolve an external spec for them. Empty for pure-consumer
  // harnesses, so they behave exactly as before.
  readonly nativeToolRefs: string[];
  readonly nativeSkillRefs: string[];
  byRef(ref: string): ToolSpec | undefined;
  // base (optional persona/system) + each EXTERNAL skill's instruction text,
  // joined with separators. Native skills are the harness's own concern.
  systemPreamble(base?: string): Promise<string>;
}
