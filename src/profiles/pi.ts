// src/profiles/pi.ts
// The "pi-main" PROFILE — a composition-root preset that makes PI the main agent.
// A profile is a named bundle of run defaults (harness + topology + env + caps);
// it lives OUTSIDE the kernel (like recommendDefaults) so the kernel stays a pure
// ref-resolver. The kernel still coordinates the topology toggle per run via
// resolveTopology() — the profile only supplies the DEFAULT topology and the env.
//
// "only pi for now": this is the single profile. A future Router picks a profile
// (and overrides topology/env) from the prompt; for now callers use this directly.

import type { ExecutionTopology } from '../types/index.js';
import type { SessionConfig } from '../kernel/index.js';

export interface RunProfile {
  /** Stable id for diagnostics / Studio. */
  readonly id: string;
  /** Harness ref — the main agent. */
  readonly harness: string;
  /** Default execution topology (the kernel may still resolve a different one). */
  readonly defaultTopology: ExecutionTopology;
  /** Default environment ref. */
  readonly environment: string;
  /** Default capability request. Omitted refs → orchestrator builder defaults. */
  readonly toolRefs?: string[];
  readonly skillRefs?: string[];
  /** Optional default model ("provider/model" or bare provider). */
  readonly model?: string;
  readonly reason: string;
}

// PI as the main agent. Default topology agent-as-tool (true isolation, runs on
// any env); local env is the zero-setup default. Swap `environment` to 'docker'
// for hardened isolation, or request topology 'agent-in-sandbox' per run.
export const PI_MAIN_PROFILE: RunProfile = {
  id: 'pi-main',
  harness: 'pi',
  defaultTopology: 'agent-as-tool',
  environment: 'local',
  // PI owns read/bash/edit/write natively (routed to env in agent-as-tool); these
  // are the non-native caps it still wants from the kernel's external set.
  toolRefs: ['read', 'bash', 'edit', 'write', 'expose_port'],
  skillRefs: [],
  // OpenRouter is the canonical provider: ONE key (OPENROUTER_API_KEY) unlocks
  // every model. Format "openrouter/<vendor>/<model>" — the id MUST exist in the
  // pi-ai registry (e.g. claude-sonnet-4.5/4.6, claude-opus-4.5/4.6/4.7; note the
  // DOT, not a dash — 'claude-opus-4-5' does NOT resolve). Swap via PI_MODEL or
  // the per-run body.model. sonnet-4.5 is the balanced workhorse default.
  model: process.env.PI_MODEL ?? 'openrouter/anthropic/claude-sonnet-4.5',
  reason: 'pi-main: PI is the main agent via OpenRouter (agent-as-tool, dual-topology)',
};

// Materialize a SessionConfig from the profile for a given session, allowing
// per-call overrides (a Router would override `topology`/`environment` here).
export function piSessionConfig(
  base: { sessionId: string } & Partial<SessionConfig>,
): SessionConfig {
  return {
    ...base, // carries sessionId + any extra SessionConfig fields (ownerId, source, …)
    harness: base.harness ?? PI_MAIN_PROFILE.harness,
    environment: base.environment ?? PI_MAIN_PROFILE.environment,
    topology: base.topology ?? PI_MAIN_PROFILE.defaultTopology,
    model: base.model ?? PI_MAIN_PROFILE.model,
    toolRefs: base.toolRefs ?? PI_MAIN_PROFILE.toolRefs,
    skillRefs: base.skillRefs ?? PI_MAIN_PROFILE.skillRefs,
  };
}
