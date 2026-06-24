import type { PreviewProgressPhase } from '@/core/preview'

// Collapse the ~17 raw provisioning `progress.phase` values into the 4 coarse stages the
// launch-diagnostic overlay shows (canvas `preview-lifecycle` flow §3.0/P1, item 7). The raw phase
// is still surfaced as the message copy; this only drives the coarse stage label/affordance. No
// capability lost — it is a display grouping, not a state.

export type PreviewStage = 'creating' | 'installing' | 'building' | 'ready' | 'recovering' | 'error'

const STAGE_BY_PHASE: Record<PreviewProgressPhase, PreviewStage> = {
  // create / materialize the workspace + container
  materializing: 'creating',
  'workspace-cloned': 'creating',
  creating: 'creating',
  // dependency install
  'prebuild-hit': 'installing',
  'install-skipped': 'installing',
  dependencies: 'installing',
  // build / dev-server bring-up
  'dist-cache-miss': 'building',
  'built-building': 'building',
  'built-failed': 'error',
  built_building: 'building',
  built_healthcheck: 'building',
  dev_starting: 'building',
  // terminal / transitional
  'session-evicted': 'error',
  ready: 'ready',
  recovering: 'recovering',
  idle: 'creating',
  error: 'error',
}

/** Map a raw provisioning phase to its coarse stage. Unknown/absent phase → `creating` (earliest). */
export function deriveStage(phase: PreviewProgressPhase | null | undefined): PreviewStage {
  if (!phase) return 'creating'
  return STAGE_BY_PHASE[phase] ?? 'creating'
}
