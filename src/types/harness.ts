// src/types/harness.ts
// The harness drives the LLM+tool loop ENTIRELY through the handle.
// Note: NO workspace_dir, NO container_id — only the opaque handle.
// (Fixes the legacy ExecuteInput leak.) Verbatim from SPEC §1.2.

import type { EngineEvent, TerminalCause } from './events.js';
import type { EnvironmentHandle } from './environment.js';
import type { ToolKit } from './tool.js';

// The execution TOPOLOGY: WHERE the agent loop runs relative to the sandbox.
// This is the user-facing toggle ("agent × sandbox-as-tool" vs "agent lives
// inside the sandbox"). It supersedes the old numeric HarnessMode (1|2): a
// harness now declares the SET of topologies it can run in, and the kernel
// resolves ONE per run against the environment's capabilities.
//
//   'agent-as-tool'    — the agent loop runs on the control plane; every tool
//                        call routes OUT to the opaque EnvironmentHandle. The
//                        harness binary never enters the sandbox. (was mode 1)
//   'agent-in-sandbox' — the agent process/server runs INSIDE the environment,
//                        operating on its own disk; the kernel spawns + drives
//                        it via env.exec/exposePort (or a host workspace dir).
//                        Requires EnvironmentCapabilities.hostsAgentRuntime.
//                        (was mode 2)
export type ExecutionTopology = 'agent-as-tool' | 'agent-in-sandbox';

export interface RunTask {
  runId: string;
  prompt: string;
  model?: string; // provider-agnostic; the harness resolves it
  allowedModels?: string[];
  signal: AbortSignal;
  // The resolved execution topology for THIS run (the kernel picks exactly one
  // from the harness's supported set, validated against the env). A dual-topology
  // harness branches on it; a single-topology harness ignores it.
  topology: ExecutionTopology;
  // Declared capability request: which tools/skills this run wants. The kernel
  // resolves them into the ToolKit handed to run(); the refs themselves are
  // diagnostics. Empty/undefined → the orchestrator applies its default set.
  toolRefs?: string[];
  skillRefs?: string[];
}

export interface HarnessCapabilities {
  providerAgnostic?: boolean;
  streaming?: boolean;
  // The topologies this harness can run in. Single-element for a fixed harness
  // (e.g. ['agent-as-tool'] for the SDK loop, ['agent-in-sandbox'] for OpenCode);
  // multi-element for a dual harness that supports the runtime toggle. The kernel
  // resolves the actual per-run topology against the env (capabilities.ts).
  topologies: ExecutionTopology[];
  // Which topology to pick when the run does not request one explicitly AND the
  // env can host it. Must be a member of `topologies`.
  defaultTopology: ExecutionTopology;
  // Tool/skill refs this harness implements INTERNALLY (e.g. OpenCode's native
  // read/write/edit/bash). For any requested ref listed here, the harness uses
  // its OWN implementation; refs NOT listed fall back to the kernel's external
  // ToolSpec/SkillSpec. The kernel resolves this partition once (native wins) and
  // hands the harness ToolKit.nativeToolRefs / .tools accordingly.
  nativeTools?: string[];
  nativeSkills?: string[];
}

export interface RunIO {
  emit: (ev: EngineEvent) => void;
}

// ─── Delegation (Pi-as-router) ────────────────────────────────────────────────
// A MAIN agent (PI) does not just run its own loop — it dispatches sub-tasks to
// OTHER (harness, environment, topology) triples picked from the live catalog.
// The kernel hands the main harness a `Delegator` in RunContext; the harness
// exposes it as a tool (`delegate`). One delegate call = one full sub-run via
// the same orchestrator, on its own child session/workspace. The sub-run's
// streaming/usage/log events are forwarded as nested progress; its terminal is
// CONSUMED (it must NOT settle the parent) and returned as DelegateResult.

export interface DelegateRequest {
  /** Harness ref to run the sub-task (e.g. 'opencode', 'claude-agent-sdk'). */
  harness: string;
  /** Environment ref the sub-run executes in (e.g. 'docker', 'e2b', 'local'). */
  environment: string;
  /** Self-contained instruction for the sub-agent. */
  task: string;
  /** Optional topology request; omitted → the sub-harness default for the env. */
  topology?: ExecutionTopology;
  /** Optional model override for the sub-run. */
  model?: string;
}

export interface DelegateResult {
  cause: TerminalCause;
  /** The sub-agent's final text (the tool result the main agent reasons over). */
  finalText: string;
  error?: { code: string; message: string };
}

// onEvent receives the sub-run's NON-terminal events (stream_chunk, tool_call,
// usage_delta, log, preview_ready, …) so the caller can forward them as nested
// progress AND so usage_delta rolls up into the parent's billing.
export type Delegator = (
  req: DelegateRequest,
  onEvent: (ev: EngineEvent) => void,
  signal: AbortSignal,
) => Promise<DelegateResult>;

// The routing menu the main agent reasons over: which harnesses/topologies and
// which environments exist. Mirrors Kernel.describeTopologies() so it can never
// drift from what actually runs.
export interface HarnessEnvCatalog {
  harnesses: { ref: string; topologies: ExecutionTopology[]; defaultTopology: ExecutionTopology }[];
  environments: { ref: string; hostsAgentRuntime: boolean }[];
}

// Extra per-run context handed to a MAIN harness so it can route. Optional on
// run(): single-purpose harnesses (cli/opencode/sdk) ignore it; only a router
// harness (pi) reads it. `depth` is the recursion level (0 = top-level entry).
export interface RunContext {
  delegate: Delegator;
  depth: number;
  catalog: HarnessEnvCatalog;
}

export interface Harness {
  // the adapter (registry value)
  readonly ref: string; // 'opencode' | 'sdk' | 'claude-cli' …
  readonly capabilities: HarnessCapabilities;
  // `kit` is the resolved tools+skills for this run. Optional for backward
  // compatibility: harnesses that own their own tool loop (cli/opencode/pi/…)
  // ignore it; kit-consuming harnesses (sdk) render kit.tools into their native
  // shape and dispatch via kit.byRef.
  // `ctx` carries the delegation seam for a MAIN/router harness (pi); other
  // harnesses ignore it.
  run(task: RunTask, env: EnvironmentHandle, io: RunIO, kit?: ToolKit, ctx?: RunContext): Promise<void>;
  cancel?(runId: string): Promise<void>;
}
