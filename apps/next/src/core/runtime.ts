// Access-layer seam — runtime feature-flag resolution for embedded L1 internal tools (Agent Studio).
// Island recreation of legacy `src/components/platform/agentStudioRuntime.ts` (pure env/host logic;
// recreated, not copied). Contract source: that file + `src/config/ports.ts::isBranchPreviewHost`.
//
// Two modes:
//   - 'baked'        → the editor is served same-origin from `/internal/{slug}/` (rollback-only; the
//                      baked artifact build chain was removed — produces no editor until restored).
//   - 'materialized' → the editor is served from a runner-materialized DIND workspace via the runner
//                      preview proxy. Resolver takes this branch only when the flag is materialized
//                      AND the node overlay carries `materialization_source`.
//
// Explicit `VITE_AOS_AGENT_STUDIO_RUNTIME` values always win. When undefined, hosted-dev hosts
// (dev.bos.pro + the project's CF branch previews) default to materialized (no baked artifact on CF
// dev). A foreign `*.pages.dev` does NOT trigger materialized — scoped check (security, legacy §7).

export type AgentStudioRuntime = 'baked' | 'materialized'

/**
 * True when `hostname` is one of THIS project's hosted-dev hosts that should default to materialized.
 * CONTRACT: legacy scoped this via `isBranchPreviewHost` to `*.vbp-german.pages.dev` only — a foreign
 * `evil.pages.dev` must NOT match. We inline the suffix here to avoid importing legacy `@/config/ports`.
 */
function isHostedDevAgentStudioHost(hostname: string | undefined): boolean {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  return h === 'dev.bos.pro' || h.endsWith('.vbp-german.pages.dev')
}

/**
 * Resolve the active Agent Studio runtime from a vite-env-shaped record + hostname. Env + hostname are
 * injected (not read off `import.meta.env`/`window` here) so tests exercise both branches purely.
 */
export function resolveAgentStudioRuntime(
  env: Record<string, string | undefined>,
  hostname?: string,
): AgentStudioRuntime {
  const configured = env.VITE_AOS_AGENT_STUDIO_RUNTIME
  if (configured === 'materialized') return 'materialized'
  if (configured === 'baked') return 'baked'
  if (configured === undefined && isHostedDevAgentStudioHost(hostname)) return 'materialized'
  return 'baked'
}

/** Live resolution from `import.meta.env` + `window.location.hostname` (runtime code path). */
export function getAgentStudioRuntime(): AgentStudioRuntime {
  const env = (import.meta.env ?? {}) as unknown as Record<string, string | undefined>
  const hostname = typeof window !== 'undefined' ? window.location?.hostname : undefined
  return resolveAgentStudioRuntime(env, hostname)
}
