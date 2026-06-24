import type { PreviewSnapshotData } from '@/core/preview'

// The simplified render-facing preview state machine (canvas `preview-lifecycle` flow §3.0). Legacy
// carried THREE overlapping enumerations (7 `PreviewStatus` → 6 `PreviewConnectionStatus` → 6
// `PreviewDisplayState` via a 9-clause cascade) plus dual built/dev sub-machines. We collapse to ONE
// 6-state machine fed directly by the backend snapshot — no second derivation layer — while
// preserving every functional outcome (proof: flow §5). Surface selection (built-vs-dev) stays
// backend-owned and is NOT a render state (read-only snapshot fields, consumed by the URL builder).

/** The six render-facing states the canvas pane shows directly. */
export type PreviewState =
  | 'provisioning'
  | 'ready'
  | 'evicted'
  | 'router_upgrade'
  | 'container_dead'
  | 'error'

/**
 * Map a backend snapshot to the render-facing state (flow §3.0 truth table).
 * - `degraded` collapses to `ready` (the fallback surface is still usable — carry).
 * - `expired` + `unavailable` fold into `error` (same UX outcome; copy varies by `error.code`).
 * - eviction and router-upgrade are NOT snapshot statuses — they are first-class states driven by the
 *   side-channel probe / iframe 426, applied by the hook OVER this base mapping.
 */
export function mapSnapshotToState(snap: PreviewSnapshotData): PreviewState {
  switch (snap.status) {
    case 'ready':
    case 'degraded':
      return 'ready'
    case 'container_dead':
      return 'container_dead'
    case 'expired':
      return 'error'
    case 'error':
      return 'error'
    case 'empty':
    case 'provisioning':
      return 'provisioning'
    default:
      return 'provisioning'
  }
}

/**
 * Version/epoch monotonic gate (flow §1, §4 — load-bearing). A snapshot is accepted only when it is
 * for the active session AND strictly advances the (epoch, version) ordering; otherwise it is stale
 * and dropped (a replayed older snapshot must never regress a ready preview).
 *
 * `prev` null → the first snapshot for the session is always accepted.
 */
export function isNewerSnapshot(
  prev: Pick<PreviewSnapshotData, 'sessionId' | 'sessionEpoch' | 'version'> | null,
  next: Pick<PreviewSnapshotData, 'sessionId' | 'sessionEpoch' | 'version'>,
  activeSessionId: string,
): boolean {
  if (next.sessionId !== activeSessionId) return false
  if (!prev || prev.sessionId !== next.sessionId) return true
  if (next.sessionEpoch > prev.sessionEpoch) return true // new epoch adopts (version resets)
  if (next.sessionEpoch < prev.sessionEpoch) return false
  return next.version > prev.version // same epoch → strictly increasing version
}

/** The degraded family — all rendered via the one shared `DegradedPanel` widget. */
export function isDegraded(state: PreviewState): boolean {
  return state === 'evicted' || state === 'router_upgrade' || state === 'container_dead' || state === 'error'
}
