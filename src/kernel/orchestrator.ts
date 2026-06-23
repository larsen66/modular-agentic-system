// src/kernel/orchestrator.ts
// Run orchestration. Builds a RunTask ({ runId, prompt, model, allowedModels,
// signal } — NO workspace_dir, NO container_id) and calls
// harness.run(task, handle, io). Pumps every io.emit(ev) through settlement and
// out to the caller's sink. Guarantees settlement fires exactly once, even if
// the harness throws or never emits a terminal event.

import { resolveHarness, buildKit } from '../registry/index.js';
import type {
  EngineEvent,
  EnvironmentHandle,
  ExecutionTopology,
  RunContext,
  RunTask,
  ToolKit,
} from '../types/index.js';
import { Settlement, type RunResult } from './settlement.js';
import { resolveTopology } from './capabilities.js';
import { PreviewRegistry } from './preview.js';

// The default capability set for a run that does not name its own. The builder
// persona: full file/shell/preview surface + web + browser, framed by the
// vite-react-app and visual-qa skills. A caller can override per RunArgs.
const DEFAULT_TOOL_REFS = ['read', 'write', 'edit', 'bash', 'expose_port', 'webfetch', 'websearch', 'browser'];
const DEFAULT_SKILL_REFS = ['vite-react-app', 'visual-qa'];

export interface OrchestratorDeps {
  preview: PreviewRegistry;
}

export interface RunArgs {
  runId: string;
  sessionId: string;
  harnessRef: string;
  prompt: string;
  model?: string;
  allowedModels?: string[];
  handle: EnvironmentHandle;
  signal: AbortSignal;
  // Optional execution-topology request (the agent-as-tool ↔ agent-in-sandbox
  // toggle). Omitted → the kernel resolves the harness default against the env.
  topology?: ExecutionTopology;
  // Optional capability request. Omitted → the default builder set above.
  toolRefs?: string[];
  skillRefs?: string[];
  // Optional delegation context for a MAIN/router harness (pi). Carries the
  // Delegator + recursion depth + routing catalog. Omitted → the harness runs
  // as a leaf agent (no sub-dispatch).
  ctx?: RunContext;
  // The sink every EngineEvent (including the synthesized terminal) is pushed to.
  emit: (ev: EngineEvent) => void;
}

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async run(args: RunArgs): Promise<RunResult> {
    const harness = resolveHarness(args.harnessRef);
    const settlement = new Settlement(args.runId);

    // Single-writer pump: fold into settlement, manage preview state, forward.
    const io = {
      emit: (ev: EngineEvent) => {
        if (ev.type === 'preview_ready') {
          this.deps.preview.set(args.sessionId, { url: ev.url, port: ev.port });
        }
        settlement.observe(ev);
        args.emit(ev);
      },
    };

    // Topology negotiation: pick exactly one runnable topology for this run from
    // the harness's supported set, validated against the env. An impossible
    // request (e.g. agent-in-sandbox on an env that can't host a runtime) settles
    // as a clean terminal — the request is invalid, NOT the env (same shape as the
    // unknown_capability_ref path below).
    const topologyDecision = resolveTopology(
      harness.capabilities,
      args.handle.capabilities,
      args.topology
    );
    if (!topologyDecision.ok) {
      const ev: EngineEvent = {
        type: 'terminal',
        cause: 'error',
        error: { code: topologyDecision.code, message: topologyDecision.message },
      };
      settlement.observe(ev);
      args.emit(ev);
      return settlement.settle('error');
    }

    // Topology-aware defaults: an agent-in-sandbox harness (OpenCode) brings its
    // OWN complete toolset and never consumes our kit, so it defaults to NO kernel
    // tools/skills — forcing the builder set on it would try to resolve external
    // specs it neither needs nor (necessarily) has registered. An agent-as-tool
    // harness (sdk) gets the builder set. A request may always override explicitly.
    const inSandbox = topologyDecision.topology === 'agent-in-sandbox';
    const toolRefs = args.toolRefs ?? (inSandbox ? [] : DEFAULT_TOOL_REFS);
    const skillRefs = args.skillRefs ?? (inSandbox ? [] : DEFAULT_SKILL_REFS);

    const task: RunTask = {
      runId: args.runId,
      prompt: args.prompt,
      model: args.model,
      allowedModels: args.allowedModels,
      signal: args.signal,
      topology: topologyDecision.topology,
      toolRefs,
      skillRefs,
    };

    // Capability negotiation (native wins): a requested ref the harness implements
    // internally is handled by the harness; the rest fall back to our external
    // ToolSpec/SkillSpec. Computed ONCE here so no harness re-derives the policy.
    const nativeTools = new Set(harness.capabilities.nativeTools ?? []);
    const nativeSkills = new Set(harness.capabilities.nativeSkills ?? []);
    const nativeToolRefs = toolRefs.filter((r) => nativeTools.has(r));
    const externalToolRefs = toolRefs.filter((r) => !nativeTools.has(r));
    const nativeSkillRefs = skillRefs.filter((r) => nativeSkills.has(r));
    const externalSkillRefs = skillRefs.filter((r) => !nativeSkills.has(r));

    // Resolve ONLY the external refs into specs (native refs are the harness's own
    // concern — they may not even have an external spec). An unknown EXTERNAL ref
    // (a request typo with no harness fallback) settles as a clean terminal, NOT a
    // misleading provision_failed — the capability request is invalid, not the env.
    let kit: ToolKit;
    try {
      kit = buildKit(externalToolRefs, externalSkillRefs, nativeToolRefs, nativeSkillRefs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const ev: EngineEvent = {
        type: 'terminal',
        cause: 'error',
        error: { code: 'unknown_capability_ref', message },
      };
      settlement.observe(ev);
      args.emit(ev);
      return settlement.settle('error');
    }

    try {
      await harness.run(task, args.handle, io, kit, args.ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The harness blew up before terminal — synthesize one so the contract
      // (terminal always arrives) and settlement (always fires) both hold.
      if (!settlement.isSettled) {
        const ev: EngineEvent = {
          type: 'terminal',
          cause: 'error',
          error: { code: 'harness_threw', message },
        };
        settlement.observe(ev);
        args.emit(ev);
      }
    }

    // Defensive: the harness returned cleanly but never emitted a terminal.
    if (!settlement.isSettled) {
      const cause = args.signal.aborted ? 'cancelled' : 'done';
      const ev: EngineEvent = { type: 'terminal', cause };
      settlement.observe(ev);
      args.emit(ev);
    }

    return settlement.settle(args.signal.aborted ? 'cancelled' : 'done');
  }
}
