import type { AppNodeMode } from '@/core/childMount'

// Types for the canvas `child-app-mount` screen + `child-app-handshake` flow (the embedded L1
// internal-tool / Agent Studio iframe). Domain FSM + component/hook prop contracts. Seam types (the
// mount resolution, the `AOS_INIT` payload) are DEFINED in the access layer (`@/core/childMount`) and
// re-exported through the feature `types/index.ts`, never redefined here.

export type { AppNode, AppNodeMode, AppNodeOverlay, ResolvedAppNode, MaterializedMount, AosInitPayload } from '@/core/childMount'

/**
 * The mount FSM (island recreation of the legacy `MountState` union; render-collapsed —
 * `iframe-loading | init-sent | ready` all show the iframe, only the handshake sub-state differs).
 */
export type ChildMountStatus =
  | 'loading-node' // resolving the node by slug + runtime
  | 'attaching-runner' // materialized: POST /sessions + poll preview status
  | 'iframe-loading' // iframe mounted, awaiting load (then AOS_INIT)
  | 'init-sent' // AOS_INIT posted, awaiting AOS_INIT_ACK (with attempt)
  | 'ready' // handshake acknowledged — child app live
  | 'no-such-app' // no `nodes` row / Supabase error (terminal)
  | 'misconfigured' // overlay unusable for the runtime (terminal)
  | 'no-session' // no Supabase session (Reload after sign-in)
  | 'failed' // handshake exhausted / resolver threw (Reload)

/** The view-level resting state the screen renders (loading | ready | error class). */
export type ChildMountViewState =
  | { kind: 'loading'; phase: 'loading-node' | 'attaching-runner' | 'handshaking' }
  | { kind: 'ready' }
  | { kind: 'error'; reason: 'no-such-app' | 'misconfigured' | 'no-session' | 'failed'; detail?: string }

/** The full hook state (drives the screen + holds the resolved iframe src/origin). */
export interface ChildMountState {
  status: ChildMountStatus
  /** Resolved iframe src (baked path or materialized previewUrl), once known. */
  iframeSrc: string | null
  /** Cross-origin `targetOrigin` for postMessage + expected ACK `event.origin`. */
  iframeOrigin: string | null
  /** Stable mount id (the app node id) — pinned into `AOS_INIT` + checked on ACK. */
  mountId: string | null
  mode: AppNodeMode | null
  /** Current handshake attempt (0-based), while `init-sent`. */
  attempt: number
  /** Failure / misconfig detail surfaced to the user. */
  detail?: string
}

// ── Component / hook props ──

/** `useChildAppMount` options (test seams: inject runtime + fetch + Supabase-shaped overrides). */
export interface UseChildAppMountOptions {
  /** Override the resolved runtime (legacy `runtimeOverride`; tests exercise both branches). */
  runtimeOverride?: 'baked' | 'materialized'
  /** Test override for the materialized resolver's fetch. */
  fetchImpl?: typeof fetch
  /** Test overrides for the poll loop. */
  maxPreviewStatusAttempts?: number
  previewStatusPollIntervalMs?: number
}

export interface UseChildAppMountResult {
  view: ChildMountViewState
  /** The loading phase label key when `view.kind === 'loading'`. */
  iframeSrc: string | null
  /** Register the live iframe element so the hook can post `AOS_INIT` into its `contentWindow`. */
  registerIframe: (el: HTMLIFrameElement | null) => void
  /** Called by the screen on the iframe `load` event (baked branch) to kick the handshake. */
  onIframeLoad: () => void
  /** Reload — re-enter `loading-node` (Reload button on `no-session` / `failed`). */
  reload: () => void
  /** True while a reload/handshake is in flight (drives the panel's busy state). */
  busy: boolean
}

/** The child-app-mount screen — chrome (loading/error/ready iframe) driven by `useChildAppMount`. */
export interface ChildAppMountScreenProps {
  /** Validated `/internal/{slug}/`-derived app slug (open-redirect guard is upstream). */
  appSlug: string
  /** Test-only runtime override forwarded to the hook. */
  runtimeOverride?: 'baked' | 'materialized'
}

/** Props for the L1 child-app iframe host component. */
export interface ChildAppIframeProps {
  src: string
  title: string
  onRegister: (el: HTMLIFrameElement | null) => void
  onLoad: () => void
}
