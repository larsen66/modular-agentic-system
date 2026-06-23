// src/kernel/capabilities.ts
// Feature-detect + graceful-fallback helpers. Core checks an adapter's
// capability flag BEFORE using an optional capability and picks a fallback,
// so the matrix never dies on the weakest env. (SPEC §5 fallback ladder.)

import type {
  Environment,
  EnvironmentCapabilities,
  EnvironmentHandle,
  ExecutionTopology,
  HarnessCapabilities,
} from '../types/index.js';

export type PreviewPolicy = 'public-url' | 'no-preview';

export function previewPolicyFor(env: Environment): PreviewPolicy {
  return env.capabilities.publicPorts ? 'public-url' : 'no-preview';
}

// Resolve a preview URL only when the env advertises publicPorts. The kernel
// never asks HOW the URL is produced — it just respects the capability flag.
export async function maybeExposePort(
  handle: EnvironmentHandle,
  port: number
): Promise<{ url: string; token?: string } | null> {
  if (!handle.capabilities.publicPorts) return null;
  return handle.exposePort(port);
}

// ─── Execution-topology negotiation (the "agent × sandbox-as-tool" vs
//     "agent-in-sandbox" toggle) ────────────────────────────────────────────
//
// A topology is RUNNABLE for a (harness, env) pair when the harness declares it
// AND the env can host it. 'agent-as-tool' needs only exec() (every env can);
// 'agent-in-sandbox' additionally needs env.hostsAgentRuntime. The kernel resolves
// EXACTLY ONE topology per run: the requested one if both sides support it, else
// the harness default (when hostable), else the first hostable supported topology.
// An impossible request settles as a clean terminal — like unknown_capability_ref.

export type TopologyDecision =
  | { ok: true; topology: ExecutionTopology }
  | { ok: false; code: 'unsupported_topology'; message: string };

function hostableTopology(
  topology: ExecutionTopology,
  harness: HarnessCapabilities,
  env: EnvironmentCapabilities | undefined
): boolean {
  if (!harness.topologies.includes(topology)) return false;
  // 'agent-as-tool' routes tool calls out via exec() — no special env capability.
  // 'agent-in-sandbox' spawns the agent process INSIDE the env — needs the gate.
  if (topology === 'agent-in-sandbox') return Boolean(env?.hostsAgentRuntime);
  return true;
}

export function resolveTopology(
  harness: HarnessCapabilities,
  env: EnvironmentCapabilities | undefined,
  requested?: ExecutionTopology
): TopologyDecision {
  if (requested) {
    if (hostableTopology(requested, harness, env)) return { ok: true, topology: requested };
    const reason = harness.topologies.includes(requested)
      ? `environment cannot host topology "${requested}" (needs hostsAgentRuntime)`
      : `harness does not support topology "${requested}" (supports [${harness.topologies.join(', ')}])`;
    return { ok: false, code: 'unsupported_topology', message: reason };
  }
  // No explicit request: prefer the harness default, else the first hostable one.
  if (hostableTopology(harness.defaultTopology, harness, env)) {
    return { ok: true, topology: harness.defaultTopology };
  }
  const fallback = harness.topologies.find((t) => hostableTopology(t, harness, env));
  if (fallback) return { ok: true, topology: fallback };
  return {
    ok: false,
    code: 'unsupported_topology',
    message: `none of the harness topologies [${harness.topologies.join(', ')}] can run on this environment`,
  };
}
