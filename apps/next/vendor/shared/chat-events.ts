/**
 * shared/chat-events.ts — Shared chat event types and error taxonomy.
 *
 * W6-1: Event type names and discriminated-union structure shared by both
 *        frontend (Vite/React) and backend (runner-service).
 * W6-2: Unified error codes with retry metadata, replacing hardcoded values
 *        in both frontend errorClassification.ts and backend chat.guards.ts.
 *
 * Import via `@shared/chat-events` from either side.
 */

// ---------------------------------------------------------------------------
// Chat event type names
// ---------------------------------------------------------------------------

/**
 * All SSE / WS event names emitted by the chat run pipeline.
 * Both frontend handleTransportEvent() and backend sendEvent() use these.
 */
export const CHAT_EVENT_TYPES = [
  'start',
  'progress',
  'dispatch',
  'question',
  'permission',
  'content_done',
  'enrichment',
  'verification',
  'complete',
  'error',
  'run_snapshot',
  /**
   * Phase 1.8.7a (openspec/changes/simplified-reliable-builder + ADR-0067).
   * Emitted when admission accepts a chat with `mode='human'`: the engine
   * is NOT started; instead `runner-service/src/support/escalateToHuman.ts`
   * writes a `support_handoffs` row with `crm_thread_id=NULL` and emits
   * this event. Frontend renders `<HumanHandoffBanner>` ("Support has been
   * notified; you'll get a reply in this chat.") in response.
   *
   * The sibling change `bos-crm-support-handoff` extends this event with
   * a CRM thread link once the bridge lands.
   */
  'human_handoff_requested',
  /**
   * Standalone settlement-phase save outcome (openspec/changes/
   * agent-run-auto-git-persistence owns the feature semantics). Emitted on the
   * wire as a flat, self-discriminating payload (`SharedGitPersistenceNotification`,
   * `event: 'git_persistence'`) via `sendEventRaw('git_persistence', …)` at
   * `runner-service/src/chatRunSettlementOrchestrator.ts:444`, and ALSO embedded
   * in the terminal `complete` payload (`SharedCompleteEventData.gitPersistence`).
   * Registered here (openspec/changes/git-persistence-event-registry, sheet PC79)
   * so the registry covers the standalone event the runner already ships.
   */
  'git_persistence',
] as const;

export type ChatEventType = (typeof CHAT_EVENT_TYPES)[number];

/**
 * EVENT_NAME_SURFACE — every distinct event-name literal the runner-service
 * pipeline emits onto its in-memory `subscribeRunEvents` emitter
 * (`runner-service/src/runState.ts`) via `runStateEmitEvent(...)`. This is
 * a SUPERSET of `CHAT_EVENT_TYPES` above: `CHAT_EVENT_TYPES` enumerates the
 * names that carry a typed payload contract in this shared module, while
 * `EVENT_NAME_SURFACE` is the full live-tail wire surface — including
 * pipeline lifecycle markers (`task_size_classified`, `run_started`) that
 * have no typed payload and are passed through transparently by both
 * transports.
 *
 * Established by openspec/changes/sse-primary-name-agnostic-consumer
 * (2026-05-13) after the `srb-2.8.5` flag flip exposed a consumer
 * whitelist drift in `subscribeRunViaSSE`. Drift-guard tests:
 *   - `runner-service/src/__tests__/runStateEmitEvent.eventNameSurface.test.ts`
 *     enumerates `runStateEmitEvent(` callsites in `runner-service/src/` and
 *     asserts every literal first-arg name is in this set.
 *   - `src/hooks/chat/__tests__/useChatStreaming.sse.nameAgnostic.test.ts`
 *     simulates one SSE frame of each name and asserts the consumer
 *     dispatches `callbacks.onEvent({eventType: <name>, …})`.
 *
 * Phase 1 seed = wire-capture (runId `26ed06b6-307a-435e-89ab-985f2a5aaed5`)
 *   on 2026-05-13. Phase 3 callsite walk completes the union.
 *
 * Both SSE (`subscribeRunViaSSE`) and runner-WS (`subscribeSession-
 * RealtimeEvents`) MUST remain wire-equivalent consumers of every name
 * listed here — neither transport may drop, rename, or normalize.
 */
export const EVENT_NAME_SURFACE: readonly string[] = [
  // Phase 1 seed — wire-capture observed names (see evidence/ folder).
  'start',
  'run_snapshot',
  'task_size_classified',
  'run_started',
  'progress',
  'content_done',

  // Phase 3 callsite walk — every literal first-arg name found in
  // `runStateEmitEvent(...)`, `emitChatEvent(...)`, and
  // `appendRunEvent({ event: '…', ...})` calls under
  // `runner-service/src/` (excluding __tests__/).
  //
  // ── Chat-run lifecycle (pipeline-level)
  'prompt_accepted',
  'provider_fallback_triggered',
  // openspec/changes/model-health-tier-failover — informational notice that an
  // admission-time model failover swapped the picked model (wired by §5.3).
  'model_failover_applied',
  'run_failed',
  'run_finished',
  'complete',
  // Settlement-phase standalone save outcome emitted via
  // `sendEventRaw('git_persistence', …)` at chatRunSettlementOrchestrator.ts:444
  // (openspec/changes/git-persistence-event-registry). Typed payload:
  // SharedGitPersistenceNotification. Also embedded in the `complete` payload.
  'git_persistence',
  'error',
  // ── Pre-flight / guided intake (admission context)
  'preflight_blocked',
  'guided_intake_question_emitted',
  'permission',
  'permission_requested',
  'permission_responded',
  'permission_response_failed',
  'clarifier_answer_received',
  'clarifier_iteration_emitted',
  // ── Agent runtime telemetry
  'agent_config_materialized',
  'learning_auto_trigger',
  'design_visual_verification',
  'human_handoff_requested',
  // ── Infrastructure / workspace lifecycle
  'session_created',
  'workspace_materialized',
  'docker_provisioned',
  // ── Preview / PTY telemetry
  'preview_proxy_error',
  'pty_connected',
  'pty_disconnected',
  'pty_exited',
  'pty_fallback',
  // ── Tool runtime
  'tool_cache_hit',
  'tool_denied',
] as const;

// ---------------------------------------------------------------------------
// model_failover_applied payload (openspec/changes/model-health-tier-failover)
// ---------------------------------------------------------------------------

/**
 * Payload for the `model_failover_applied` run event — an informational notice
 * that admission swapped an invalid (quarantined / admin-disabled) picked
 * model for a healthy same-tier model, or failed open on the originally-picked
 * model. NOT an error: the run proceeds. Surfaced to the user via the
 * `<FailoverNotice>` component in the UX2 chat renderer.
 */
export interface ModelFailoverAppliedPayload {
  /** The originally-picked model the user or tier resolved to. */
  requestedModel: { provider: string; model: string };
  /** The model the run actually used. Equal to `requestedModel` on fail-open. */
  actualModel: { provider: string; model: string };
  /** Why failover fired. `no_healthy_candidate` is the fail-open case. */
  reason: 'quarantine' | 'admin_disabled' | 'no_healthy_candidate';
  /**
   * openspec/changes/model-health-tier-failover §D13 — which health band the
   * swap target came from. `'amber'` = the green band was empty and failover
   * landed on an unproven (not-known-bad) model. Absent on a fail-open or from
   * a pre-D13 runner.
   */
  band?: 'green' | 'amber';
}

// ---------------------------------------------------------------------------
// Admission wire-protocol types (openspec/changes/chat-admission-idempotency-key)
// ---------------------------------------------------------------------------

/**
 * RFC 4122 v4 UUID stamped by the client per user-intended message and
 * carried through every retry path so the backend can recognize duplicate
 * admissions and rebind the caller to the original `runId`.
 *
 * Stability rules (spec §Idempotency key on every chat admission):
 *   - Fresh user submit → new UUID (typically reuses `userMessageId`).
 *   - `scheduleAutoRetry` (`_isAutoRetry`) → reuse the original key.
 *   - `retryLastMessage` (user Retry button) → reuse the original key.
 *   - `useFirstRun.dispatchFirstRun` → reuse `intent.idempotencyKey`
 *     across both `reconnecting` (30s) and `retryable` (10s) branches.
 */
export type IdempotencyKey = string;

/**
 * Body of `POST /sessions/:id/chat` from the perspective of the admission
 * contract.  Concrete request bodies (validated by the runner's
 * `chatSchema` zod object) carry additional optional fields — this
 * interface defines the SLICE that the admission gate reads.
 *
 * `idempotencyKey` is OPTIONAL during the Phase A deprecation window
 * (`chat-admission-idempotency-key`).  Phase B (`chat-admission-idempotency-required`)
 * flips backend behaviour to reject the missing field with
 * `400 Bad Request` `code: 'idempotency_key_required'`.
 */
export interface ChatAdmissionRequest {
  /** The user's prompt — non-empty when present. */
  prompt: string;
  /** Target chat (UUID). When absent, the runner derives it from the session. */
  chatId?: string;
  /** Client-supplied idempotency key (UUIDv4). See `IdempotencyKey` doc. */
  idempotencyKey?: IdempotencyKey;
  /** Trace/diagnostic correlation; not used for dedup. */
  correlationId?: string;
}

/**
 * Body of the admission response from the runner.
 *
 * Two shapes share this interface:
 *   - Fresh admission (`HTTP 202 Accepted`): `duplicate` is absent or
 *     `false`; `originalAdmittedAt` is absent.
 *   - Duplicate admission (`HTTP 200 OK`): `duplicate === true` and
 *     `originalAdmittedAt` is the ISO-8601 timestamp of the first
 *     admission within the 60-minute TTL window.
 *
 * Spec §Duplicate POST within TTL returns existing runId with 200 OK.
 */
export interface ChatAdmissionResponse {
  /** The run that this admission resolved to (existing or new). */
  runId: string;
  /** Current phase of that run. */
  phase: RunPhase | string;
  /** Present and `true` only when the request collapsed onto an existing run. */
  duplicate?: boolean;
  /** ISO-8601 timestamp of the original admission, present iff `duplicate`. */
  originalAdmittedAt?: string;
}

// ---------------------------------------------------------------------------
// Per-event payload interfaces (frontend-consumable, no backend-only deps)
// ---------------------------------------------------------------------------

/**
 * Start event payload — sent when the chat run begins.
 *
 * NOTE: The backend `StartEventData` includes `ChatRunPhase` and other
 * backend-specific fields.  This shared interface defines the wire shape
 * that the frontend actually reads.
 */
export interface SharedStartEventData {
  sessionId: string;
  runId: string;
  message: string;
  // PS158 / BS248 (2026-06-08, PR #880 `a41b34f79d`): run-detail fields are
  // REDACTED for non-owner/admin callers — the key is omitted entirely (see
  // `chatRunPipeline.ts` `callerCanViewRunDetail`). They are therefore OPTIONAL
  // on the wire; privileged callers still send them. Frontend reads them
  // defensively (`chatEventHandlers.ts` `typeof … === 'string'`), so absence is
  // safe. (Previously these were required, which made the redacted member/viewer
  // payload fail to type-check against this interface — TS2345.)
  model?: string;
  provider?: string;
  agent?: string;
  depth: string | undefined;
  resolvedModel?: string;
  resolvedProvider?: string;
  resolvedAgent?: string;
  modelOrigin?: string;
  phase?: string;
}

/**
 * Content-done event payload — sent when model content stream ends,
 * BEFORE enrichment/verification/persistence. Signals the frontend
 * to unlock the UI (allow new prompts) while post-settlement runs.
 */
export interface SharedContentDoneEventData {
  runId: string;
  model: string;
  provider: string;
}

/**
 * Complete event payload — sent when the chat run finishes.
 *
 * `gitPersistence` (openspec/changes/agent-run-auto-git-persistence
 * task 4.1): typed save outcome the frontend uses to render the
 * terminal save toast/banner. Backend emits the typed payload; frontend
 * renders user-visible copy from `userMessageKey` + `status` (closed set).
 * Frontend MUST NOT infer GitHub success from `success: true` alone.
 */
export interface SharedCompleteEventData {
  success: boolean;
  runId: string;
  durationMs: number;
  model: string;
  provider: string;
  phase?: string;
  gitPersistence?: SharedGitPersistenceNotification;
}

/** Closed-set status taxonomy mirrored in
 *  `runner-service/src/gitPersistence/types.ts::GitPersistenceStatus`
 *  and the DB CHECK constraint
 *  `supabase/migrations/20260519100000_run_git_persistence.sql`. */
export type SharedGitPersistenceStatus =
  | 'pending'
  | 'skipped_disabled'
  | 'skipped_no_changes'
  | 'skipped_no_authority'
  | 'skipped_no_repo'
  | 'blocked_audit_unavailable'
  | 'blocked_preexisting_dirty_overlap'
  | 'commit_succeeded_push_succeeded'
  | 'commit_succeeded_push_rejected_recovery_pushed'
  | 'commit_succeeded_push_failed'
  | 'commit_failed'
  | 'pending_push';

export type SharedGitPersistencePolicy = 'off' | 'commit_only' | 'commit_and_push';

export type SharedGitPersistenceErrorKind =
  | 'auth_failed'
  | 'permission_denied'
  | 'repo_not_found'
  | 'network'
  | 'timeout'
  | 'recovery_push_failed'
  | 'detached_head'
  | 'no_remote'
  | 'no_token'
  | 'commit_error'
  | 'unknown';

export interface SharedGitPersistenceNotification {
  event: 'git_persistence';
  runId: string;
  status: SharedGitPersistenceStatus;
  policy: SharedGitPersistencePolicy;
  commitSha: string | null;
  branch: string | null;
  recoveryBranch: string | null;
  recoverySha: string | null;
  repoUrl: string | null;
  errorKind: SharedGitPersistenceErrorKind | null;
  /** Count of files set aside as genuine baseline overlaps. >0 alongside a
   *  commit/push success status = a partial save: the safe subset reached
   *  GitHub, N file(s) were left for the user to review. Optional — an old
   *  runner omits it and the frontend degrades to the plain "saved" copy. */
  conflictCount?: number;
  userMessageKey: string;
}

/** Statuses for which the frontend may show "saved to GitHub" copy. */
export const SHARED_SAVED_TO_GITHUB_STATUSES: ReadonlySet<SharedGitPersistenceStatus> = new Set([
  'commit_succeeded_push_succeeded',
  'commit_succeeded_push_rejected_recovery_pushed',
]);

/**
 * AC12 (2026-04-16): dispatch event — transparent, friendly visibility into
 * the intent-resolution stage between admission (202) and first stream token.
 *
 * Three phases, each emitted at most once per run:
 *
 *   - `intent_resolved` — the rule-based resolver classified the prompt.
 *     Instant (sub-millisecond). Always emitted.
 *   - `exploring`       — deterministic resolver returned `unknown` (or the
 *     dispatch policy asked for clarification), and the LLM exploratory pass
 *     is about to run. Emitted ONLY when the exploratory pass fires.
 *   - `refined`         — exploratory pass returned. Carries the model's
 *     refined intent, confidence, a SHORT user-friendly reasoning line
 *     (backend clamps to ≤80 chars — long CoT stays on the server), and
 *     `should_proceed`. Emitted ONLY when exploratory pass produced output.
 *
 * The frontend renders these as a miniature dispatch trail inside the
 * existing AgentActivityShell (no new mount point). Old clients that do
 * not understand `dispatch` simply ignore it — the event is purely additive.
 */
export interface SharedDispatchEventData {
  phase: 'intent_resolved' | 'exploring' | 'refined' | 'routed';
  /** Canonical intent label for the current phase.
   *  - intent_resolved: rule-based resolver's label (may be 'unknown')
   *  - exploring:       pre-exploratory label (usually 'unknown')
   *  - refined:         model's refined label ('unknown' if pass could not refine) */
  intentLabel?: string;
  /** Confidence in `[0.0, 1.0]`. Rule confidence for `intent_resolved`;
   *  model confidence for `refined`. Absent for `exploring`. */
  confidence?: number;
  /** Stable rule id (for `intent_resolved`) or `"exploratory/<label>"` (for
   *  `refined`). Useful for telemetry; the UI does not render this. */
  ruleId?: string;
  /** SHORT human-friendly reasoning line for `refined`. Clamped by the
   *  backend to ≤80 characters — long chain-of-thought must stay on server. */
  reasoning?: string;
  /** True only for `refined` when the model thinks the prompt has enough
   *  info to execute. When false, the pipeline usually proceeds to
   *  guided_intake (clarifier card). */
  shouldProceed?: boolean;
  /** For `refined`: present when backend identified the primary missing slot
   *  (target_object | desired_change | location | acceptance_criteria |
   *  scope) — the UI renders this as a small "Уточняем: <slot>" label on
   *  the clarifier card so the user sees WHAT is being asked. */
  primaryGap?: string;
  /** Latency of the just-completed phase in milliseconds. Absent for
   *  `exploring` (phase hasn't finished yet when event is emitted). */
  latencyMs?: number;
  /** R3 routing's top-selected skill — the manifest entry the agent has
   *  been pointed at via `<domain_reference_docs>`. Absent if router
   *  selected zero skills (intent did not match any available reference
   *  doc). The frontend renders this as a chip next to the model chip on
   *  the assistant message header so the user sees what context the
   *  agent is leaning on. Emitted on the `intent_resolved` phase only. */
  selectedSkill?: {
    /** Stable identity, e.g. `crm.funnel.configure_db`. */
    skillKey: string;
    /** Human-readable name, e.g. `Configure CRM funnel via child DB`. */
    displayName: string;
    /** Up to 8 trigger keywords from the skill's `index_terms` — shown in the
     *  chip's hover tooltip so the user understands why this doc fired. */
    triggers: string[];
  };
}

/**
 * Error event payload — sent on run-level errors (SSE error frame).
 *
 * `metadata` is an OPTIONAL, loose bag of structured data attached to
 * specific error codes by the backend. It is deliberately untyped at
 * this shared layer — consumer modules narrow it to a typed view at
 * their boundary.
 *
 * Current users:
 *   - `clarification_required` attaches
 *     `{ reasons: string[]; scope_hint: {preferred_scope, reason} | null;
 *        originalPrompt: string; intent_label: string }`
 *     so the frontend can render an interactive clarification card.
 *
 * Other error codes may attach their own keys in the future. Readers
 * that do not know a code MUST ignore the metadata field — it is
 * forward-compatible by design.
 *
 * See `ceo/local/plans/2026-04-11__aos-front-door-clarification-loop.md`.
 */
export interface SharedErrorEventData {
  error: string;
  code: string;
  metadata?: Record<string, unknown>;
}

/**
 * `human_handoff_requested` event payload — Phase 1.8.7a of
 * openspec/changes/simplified-reliable-builder.
 *
 * Emitted by `runner-service/src/support/escalateToHuman.ts` when the
 * chat admission accepted `mode='human'`. v1 fields cover the seam the
 * frontend banner needs; the sibling change `bos-crm-support-handoff`
 * extends with `crm_thread_id` + `crm_thread_url` once the CRM edge
 * function `support-thread-create` lands.
 */
export interface SharedHumanHandoffRequestedEventData {
  /** support_handoffs.id — durable handoff record key. */
  handoff_id: string;
  /** support_handoffs.cloved_chat_id — for client-side routing. */
  chat_id: string;
  /** support_handoffs.run_id — echoes the run that triggered the handoff. */
  run_id: string;
  /** Closed-set status; v1 always `pending_bridge`. */
  status: 'pending_bridge' | 'awaiting_support' | 'in_progress' | 'routed_to_crm' | 'resolved';
  /** ISO-8601 timestamp of `support_handoffs.created_at`. */
  created_at: string;
}

/**
 * Permission request event payload — emitted when OpenCode asks for an
 * explicit user decision before a non-auto-granted action such as write/bash.
 * The payload intentionally carries safe metadata only: IDs, kind, tool/call
 * references, and path/pattern summaries, never file contents.
 */
export interface SharedPermissionEventData {
  permissionId: string;
  permissionKind: string;
  sessionID?: string;
  callID?: string;
  messageID?: string;
  toolName?: string;
  patterns?: string[];
  filePath?: string;
  openedAt?: string;
}

// ---------------------------------------------------------------------------
// Run snapshot types (ADR 0036: serialized read-model over existing pipeline)
// ---------------------------------------------------------------------------

/**
 * User-facing execution phase emitted by the backend run snapshot.
 * Maps from internal ChatRunPhase (FSM) to clean external vocabulary.
 */
export type RunPhase =
  | 'dispatching'         // Client intent POSTed, admission in progress
  | 'preparing'           // Backend accepted run; infra pre-flight in progress
  | 'streaming'           // Model/tool output actively arriving
  | 'waiting_input'       // Backend blocked on user answer (question)
  | 'waiting_children'    // Parent output done; child sessions still active
  | 'verifying'           // Post-content enrichment/verification running
  | 'settled_success'     // Terminal: run fully done
  | 'settled_incomplete'  // Terminal: ended without full child completion
  | 'settled_error'       // Terminal: run failed
  | 'cancelled';          // Terminal: user or backend cancelled

export const RUN_PHASES = [
  'dispatching',
  'preparing',
  'streaming',
  'waiting_input',
  'waiting_children',
  'verifying',
  'settled_success',
  'settled_incomplete',
  'settled_error',
  'cancelled',
] as const satisfies readonly RunPhase[];

export const TERMINAL_RUN_PHASES = [
  'settled_success',
  'settled_incomplete',
  'settled_error',
  'cancelled',
] as const satisfies readonly RunPhase[];

const RUN_PHASE_SET = new Set<string>(RUN_PHASES);
const TERMINAL_RUN_PHASE_SET = new Set<string>(TERMINAL_RUN_PHASES);

export function isRunPhase(value: unknown): value is RunPhase {
  return typeof value === 'string' && RUN_PHASE_SET.has(value);
}

export function isTerminalRunPhase(value: unknown): value is (typeof TERMINAL_RUN_PHASES)[number] {
  return typeof value === 'string' && TERMINAL_RUN_PHASE_SET.has(value);
}

/**
 * Serialized read-model for one accepted run (ADR 0036).
 * Emitted at each phase transition via `run_snapshot` event.
 */
export interface RunLedgerSnapshot {
  runId: string;
  sessionId: string;
  chatId: string;
  phase: RunPhase;
  version: number;            // monotonic per run
  runtime?: string;
  containerId?: string;
  childSessions?: { sessionId: string; status: string }[];
  startedAt: string;
  updatedAt: string;
  settledAt?: string;
  /** 4b: ISO timestamp when the current active timeout expires.
   *  Omitted on terminal phases (no timeout running). */
  timeoutAt?: string;
  error?: { code: string; message: string };
}

/**
 * Discriminated union of all chat events using the shared payload types.
 *
 * The backend's `TypedChatEvent` in chatEvents.ts is a superset with
 * backend-specific payload types (OpenCodeProgress, PendingQuestionSnapshot,
 * VerificationOutcome).  This shared union uses looser payloads suitable
 * for frontend consumption.
 */
export type SharedChatEvent =
  | { event: 'start'; data: SharedStartEventData }
  | { event: 'progress'; data: Record<string, unknown> }
  | { event: 'dispatch'; data: SharedDispatchEventData }
  | { event: 'question'; data: Record<string, unknown> }
  | { event: 'permission'; data: SharedPermissionEventData }
  | { event: 'content_done'; data: SharedContentDoneEventData }
  | { event: 'enrichment'; data: Record<string, unknown> }
  | { event: 'verification'; data: Record<string, unknown> }
  | { event: 'complete'; data: SharedCompleteEventData }
  | { event: 'error'; data: SharedErrorEventData }
  | { event: 'run_snapshot'; data: RunLedgerSnapshot }
  | { event: 'human_handoff_requested'; data: SharedHumanHandoffRequestedEventData }
  // Flat, self-discriminating member (design D2, git-persistence-event-registry):
  // SharedGitPersistenceNotification declares `event: 'git_persistence'` inline
  // and is sent as that flat object on the wire (NOT an `{ event, data }`
  // envelope). A value of this type narrows through SharedChatEvent on
  // `event === 'git_persistence'`.
  | SharedGitPersistenceNotification;

// ---------------------------------------------------------------------------
// Chat event map (event name → payload type)
// ---------------------------------------------------------------------------

export interface SharedChatEventMap {
  start: SharedStartEventData;
  progress: Record<string, unknown>;
  dispatch: SharedDispatchEventData;
  question: Record<string, unknown>;
  permission: SharedPermissionEventData;
  content_done: SharedContentDoneEventData;
  enrichment: Record<string, unknown>;
  verification: Record<string, unknown>;
  complete: SharedCompleteEventData;
  error: SharedErrorEventData;
  run_snapshot: RunLedgerSnapshot;
  human_handoff_requested: SharedHumanHandoffRequestedEventData;
  // Flat payload (design D2) — name → payload type is unambiguous.
  git_persistence: SharedGitPersistenceNotification;
}

// ---------------------------------------------------------------------------
// W6-2: Unified error taxonomy
// ---------------------------------------------------------------------------

/**
 * Error code metadata for chat errors.
 *
 * `retryable`: whether the client should auto-retry.
 * `defaultDelayMs`: base delay in ms before retry (caller applies backoff).
 */
export interface ChatErrorCodeMeta {
  retryable: boolean;
  defaultDelayMs?: number;
}

/**
 * Canonical error codes emitted by the runner and consumed by the frontend.
 *
 * These values EXACTLY match the hardcoded codes in:
 * - runner-service/src/routes/chat.guards.ts (backend error responses)
 * - runner-service/src/chatRunState.ts (FSM settlement codes)
 * - runner-service/src/opencode/serveExecutionAdapter.ts::classifyStreamError()
 * - src/lib/chat/errorClassification.ts (frontend retry decisions)
 *
 * Wave 1 of 2026-04-09__a2-error-taxonomy-end-to-end.md split the single
 * `provider_timeout` FSM code into phase-meaningful codes so the frontend
 * can distinguish timeout causes without parsing English text. The old
 * `provider_timeout` is kept as a deprecated alias because
 * `classifyStreamError` still emits it for provider-reported timeouts
 * (provider-text classification, not FSM stall detection).
 */
export const CHAT_ERROR_CODES = {
  // ── Admission / infrastructure ─────────────────────────────────────
  workspace_initializing: { retryable: true, defaultDelayMs: 10_000 },
  ai_preparing: { retryable: true, defaultDelayMs: 10_000 },
  serve_unavailable: { retryable: true, defaultDelayMs: 5_000 },
  container_dead: { retryable: false },
  container_recovering: { retryable: true, defaultDelayMs: 5_000 },
  session_not_found: { retryable: false },
  // Phase 3 of openspec/changes/hygiene-hibernation-consistency (codex review
  // 2026-05-26 P2 #2): per-reason 404 split. The bare `session_not_found` is
  // the legacy/fallback for sessions that were never tracked OR whose
  // recentEvictions LRU entry expired (1h TTL). The four variants below carry
  // the explicit hygiene-eviction reason so the i18n layer can render specific
  // honest text per cause.
  session_evicted_zombie: { retryable: false },
  session_evicted_idle_timeout: { retryable: false },
  session_evicted_lru: { retryable: false },
  session_evicted_stuck_created: { retryable: false },
  conflict: { retryable: false },  // legacy — replaced by writer_lock_conflict / session_run_active
  writer_lock_conflict: { retryable: false },
  session_run_active: { retryable: true, defaultDelayMs: 3_000 },
  auth_failed: { retryable: false },
  billing_exceeded: { retryable: false },
  /**
   * F1 cutover (2026-05-18 task 3.1d): admission rejected because the org's
   * credit balance is below the configured threshold. Carried by HTTP 202 +
   * `body.rejection_code='insufficient_balance'` per
   * `specs/billing-runtime-cutover/spec.md`. The frontend renders the
   * InsufficientBalanceCard against the optimistic assistant row; auto-retry
   * helpers MUST NOT retry — user has to top up first.
   */
  insufficient_balance: { retryable: false },
  rate_limited: { retryable: true, defaultDelayMs: 30_000 },
  context_exceeded: { retryable: false },
  prompt_too_long: { retryable: false },
  session_degraded: { retryable: true, defaultDelayMs: 3_000 },
  session_not_ready: { retryable: true, defaultDelayMs: 5_000 },
  /**
   * BFA05 (2026-04-21): specialization of `session_not_ready` for the
   * auto-submit admission race. Emitted by `guardSessionReady` when the
   * caller is the first-run auto-dispatcher and the session is still in
   * `created`/`provisioning` with `chatAccepting=false`. Distinct code so
   * the frontend can render a silent "Still preparing…" wait (NO red
   * banner, NO "Server unavailable. Retrying…") — the user didn't do
   * anything wrong, the auto-dispatcher fired early by design.
   *
   * Contract:
   *   - 400 status (not 503 — this is expected pre-admission, not server error)
   *   - Body: { error, code: 'SESSION_NOT_ADMITTING_YET', retryAfterMs, sessionId, status }
   *   - Frontend: classify as rejected with kind='rejected' so useBosFirstRun
   *     re-queues on snapshot tick without banner.
   */
  SESSION_NOT_ADMITTING_YET: { retryable: true, defaultDelayMs: 2_500 },

  // ── Provider transient failures (2026-04-20: origin attribution) ────
  /** Provider returned HTTP 403 mid-stream (e.g. OpenAI Responses API
   *  rejecting a token after `response.created`). Almost always transient
   *  — the provider's edge/proxy temporarily rejected the request. Auto-retry
   *  with short backoff usually succeeds. Distinct from `auth_failed` (403
   *  on initial admission, requires user re-auth) and `rate_limited`
   *  (provider returned 429). */
  provider_forbidden: { retryable: true, defaultDelayMs: 3_000 },
  /** Provider returned 5xx mid-stream — provider's backend had a transient
   *  failure. Retry with backoff. Already covered by `provider_error` for
   *  text-classified 5xx; this code is reserved for HTTP-status-classified
   *  hits to keep the wire signal clean. */
  provider_overloaded: { retryable: true, defaultDelayMs: 5_000 },
  /** BFA08 (2026-04-22): provider returned a structured 5xx error in the SSE
   *  error envelope (OpenAI `server_error`, Anthropic `api_error`). Parsed by
   *  `runner-service/src/opencode/providerErrorParser.ts` from the envelope
   *  that used to fall through to generic `serve_error`. Distinct from
   *  `provider_error` (text-heuristic match on "internal server error" etc.)
   *  and `provider_overloaded` (HTTP 502/503/504 status) — this code is the
   *  canonical "structured upstream 5xx" signal. Retry with backoff. */
  provider_server_error: { retryable: true, defaultDelayMs: 5_000 },

  // ── Pre-flight / live-agent resolution ─────────────────────────────
  // A2 Wave 1: registry honesty — these are already emitted by the runner
  // but were missing from the registry.
  preflight_error: { retryable: false },
  agent_not_found: { retryable: false },
  /** Dispatch policy determined the prompt is too vague to execute.
   *  NOT retryable in-place — the user must clarify their request with
   *  more detail. Emitted by `chatRunPreFlight.ts` when
   *  `evaluateDispatchPolicy().clarification.decision === 'clarify'`. */
  clarification_required: { retryable: false },
  /** Capability gate determined the selected model cannot handle the
   *  required capabilities (e.g. image input on a non-vision model, or
   *  a billing-downgraded model lacking vision). NOT retryable — the
   *  user must either switch to a capable model or remove the
   *  incompatible input (e.g. remove the image attachment). Emitted by
   *  `chatRunPreFlight.ts` G8 capability gate. */
  capability_mismatch: { retryable: false },

  // ── Provider / model surface ───────────────────────────────────────
  /** Provider rejected the request because the tool-call history is
   *  structurally invalid (e.g. empty `call_id`, mismatched tool results).
   *  NOT retryable in-place — the same history would be re-sent and fail
   *  again. User must start a fresh chat to reset the conversation state.
   *  Emitted by `serveExecutionAdapter.ts` / `chatRunPipeline.ts` when the
   *  provider returns a validation error on the tool history. AC03. */
  provider_invalid_tool_history: { retryable: false },
  /** Generic serve-session failure — catch-all for backend serve-execution
   *  corridor errors that could not be narrowed to a more specific code
   *  (e.g. session.error without a known subtype). Retryable — typically a
   *  transient container/session state issue. Replaces the user-visible
   *  "Serve session error" string. AC03. */
  serve_session_generic: { retryable: true, defaultDelayMs: 5_000 },
  /**
   * ASMS-FIX-MODELRETRY (2026-04-29): flipped retryable=true → false.
   *
   * Production incident: tester picked `openrouter/google/gemini-2.5-
   * flash-preview-09-2025`, OpenRouter returned `404 No endpoints found`
   * with `isRetryable: false`. The runner classified this as
   * `model_unavailable`, but this code's `retryable: true` flag drove
   * the frontend's auto-retry into a hot loop — same 404 every 10s
   * forever, UI stuck on "Server unavailable. Retrying...".
   *
   * The matcher in serveExecutionAdapter.ts maps "model not found",
   * "no endpoints", "model_not_found", "does not exist", "not currently
   * available" — ALL of which are structural (model gone / never
   * existed / provider revoked access). Retry on the same model
   * produces the same error indefinitely.
   *
   * Action remains `switch_model` (see attribute table below) — the UI
   * already renders the "Switch model" CTA via ErrorBanner, but it
   * never got to show because retry kicked first.
   *
   * Transient overload cases (e.g. "OpenAI is temporarily overloaded")
   * are matched separately by the `provider_overloaded` HTTP-status
   * branch — that one stays retryable.
   */
  model_unavailable: { retryable: false },
  content_filtered: { retryable: false },
  /** Provider 5xx / internal server error / bad gateway / service unavailable.
   *  Emitted by `classifyStreamError` when the provider text matches 502/503
   *  / "internal server error" / "bad gateway" / "service unavailable". After
   *  A2 Wave 2 the FSM does NOT emit this code directly — FSM STREAM_ERROR
   *  paths default to `transport_error` unless `classifyStreamError` already
   *  upgraded them to a more specific code (billing_exceeded, rate_limited,
   *  provider_error, etc.) which is then threaded through via the new
   *  `STREAM_ERROR.code` plumbing. Retryable. */
  provider_error: { retryable: true, defaultDelayMs: 5_000 },
  /** Transport-layer serve error (A2 Wave 2). Emitted by the FSM on
   *  non-benign STREAM_ERROR paths when no more-specific code was classified
   *  upstream. Covers SSE connection death, curl failures, the synthetic
   *  "stream ended unexpectedly" case, and generic serve session errors
   *  during prompt sending. Distinct from `provider_error` (provider 5xx)
   *  and `http_timeout` (read deadline). Retryable — typically a transient
   *  network issue. */
  transport_error: { retryable: true, defaultDelayMs: 5_000 },
  /** W2-2 (chat-transport-error-honesty plan, 2026-04-28): provider HTTP
   *  socket dropped mid-stream after content was delivered. Distinct from
   *  generic `transport_error` (which covers all non-classified network
   *  failures). Detected by the FSM when STREAM_ERROR carries the
   *  node:fetch marker "socket connection was closed unexpectedly".
   *  Live evidence: run `7cd417ae` 2026-04-28 07:04:16Z — 5+ minutes of
   *  streamed content lost when OpenAI socket dropped. Retryable with the
   *  original prompt; partial content is preserved client-side. */
  upstream_socket_drop: { retryable: true, defaultDelayMs: 5_000 },
  serve_error: { retryable: true, defaultDelayMs: 5_000 },

  // ── Lifecycle anomalies (A2 Wave 2) ─────────────────────────────────
  /** Client transport closed before admission (`CLIENT_DISCONNECT` with
   *  `promptAccepted: false` in the FSM). NOT retryable in-place — there
   *  is no client to deliver the retry to; the recovery path is the user
   *  sending a new prompt when they reconnect. Distinct from
   *  `transport_error` (serve-side SSE failure) and `provider_error`
   *  (provider answering with an error): here the CLIENT hung up. */
  client_disconnected: { retryable: false },
  /** OpenCode session emitted an idle/done event BEFORE the prompt was
   *  accepted (`DONE_EVENT` in the `prompt_sending` FSM phase). Protocol
   *  anomaly — the session told us it was done with a prompt we never
   *  actually sent. NOT retryable: retry hits the same cached session
   *  state and will repeat the anomaly. Session reset is the recovery
   *  path. */
  premature_done: { retryable: false },

  // ── Timeout family (A2 Wave 1 split) ───────────────────────────────
  // Each code is emitted at exactly one FSM phase × event-class site in
  // `runner-service/src/chatRunState.ts`. Frontend groups them in
  // `src/lib/chat/errorClassification.ts::presentationGroup()`.
  /** Prompt accepted, AI never produced first token (awaiting_output
   *  STALL_ABORT + IDLE_TIMEOUT). Retryable — likely transient. */
  awaiting_output_timeout: { retryable: true, defaultDelayMs: 5_000 },
  /** Stream was producing then stopped mid-output (streaming IDLE_TIMEOUT
   *  + STALL_ABORT). Retryable — likely transient. */
  stream_stall_timeout: { retryable: true, defaultDelayMs: 5_000 },
  /** Wire is alive (SSE keep-alive frames flowing) but the model stopped
   *  emitting visible content for the content-progress budget. Verified
   *  2026-04-30 via tcpdump on prod runs `c1add8e8` and `3db1efd7`:
   *  OpenRouter ships ~53-byte TLS records every ~420 ms (`:OPENROUTER
   *  PROCESSING` SSE comment frames) while upstream inference is hung,
   *  so `stream_stall_timeout` (wire-silence gate) does NOT fire. This
   *  code distinguishes the upstream-inference-hang scenario from a
   *  plain wire stall. Retryable — a fresh request to OpenRouter usually
   *  succeeds because the hang is per-inference, not per-account. The
   *  frontend `ErrorBanner.StallAutoRetryCountdown` fires ONE silent
   *  auto-retry on this code; further attempts are manual. */
  content_progress_timeout: { retryable: true, defaultDelayMs: 5_000 },
  /** W4-D5 (2026-04-28): tighter-budget abort for reasoning-marathon-prone
   *  models (z-ai/glm-5.1, kimi-k2.6 on overlong tasks) — model spent the
   *  full content budget on reasoning tokens with zero user-visible work.
   *  Marked retryable so it routes through the same classifier path as
   *  the timeout family, but the attribution `action: 'switch_model'`
   *  steers the UI toward a model swap instead of same-model retry
   *  (same-model retry usually loops on the same reasoning marathon). */
  reasoning_marathon_aborted: { retryable: true, defaultDelayMs: 5_000 },
  /** AI asked a question, user didn't answer in time (question_pending
   *  QUESTION_TIMEOUT). NOT retryable — needs user intent to continue. */
  question_timeout: { retryable: false },
  /** OpenCode permission request was denied by the user. NOT retryable in
   *  place because retrying the same prompt may ask for the same authority. */
  permission_denied: { retryable: false },
  /** OpenCode permission request expired without a user decision. */
  permission_timeout: { retryable: false },
  /** OpenCode no longer considers the permission id pending. */
  permission_stale: { retryable: false },
  /** Runner could not deliver the permission response to the destination. */
  permission_unreachable: { retryable: true, defaultDelayMs: 5_000 },
  /** Generic permission response failure. Retry may succeed if transport recovers. */
  permission_response_failed: { retryable: true, defaultDelayMs: 5_000 },
  /** Post-stream enrichment / verification phase stalled (completing
   *  IDLE_TIMEOUT + STALL_ABORT). Retryable but with a shorter delay —
   *  partial content may already be usable; retry is best-effort cleanup. */
  enrichment_timeout: { retryable: true, defaultDelayMs: 3_000 },
  /** Parent run finished but sub-agent children hung past the wait window
   *  (waiting_children CHILD_WAIT_TIMEOUT). Retryable — partial parent
   *  result may be acceptable; retry gives children another chance. */
  child_wait_timeout: { retryable: true, defaultDelayMs: 5_000 },
  /** Transport-level HTTP read timeout (wildcard HTTP_TIMEOUT). */
  http_timeout: { retryable: true, defaultDelayMs: 5_000 },
  /** Whole-run max budget exhausted (wildcard HARD_TIMEOUT).
   *  NOT retryable — retry would hit the same cap. */
  hard_timeout: { retryable: false },
  /** @deprecated FSM-side. Use the phase-specific codes above.
   *  Kept in the registry because `classifyStreamError()` still emits it
   *  for provider-reported timeouts (text classification, not FSM stall
   *  detection — different semantic source). Frontend should still
   *  handle it for backwards-compatibility. */
  provider_timeout: { retryable: true, defaultDelayMs: 5_000 },

  // ── Reaper / lifecycle kill (chat-pipeline-error-correctness §1.5) ───
  /** Run was killed by a background reaper (idle_kill, container_oom,
   *  cleanup_job, restart_lost) instead of completing naturally. NOT
   *  retryable — the user-intent SI / dispatch state is lost when the
   *  session context is destroyed, so a retry from the same chat hits
   *  a stale or absent session. The frontend renders "Start a new chat"
   *  as the recovery CTA. The reaper writer pairs this code with
   *  `terminal_cause='reaper'` and a non-null `summary.reaperReason`. */
  reaper_killed: { retryable: false },

  // ── Stream abort / unclassified backstop (chat-error-classification-recovery) ──
  /** A mid-stream AbortError that is NOT a user-requested cancel. Emitted
   *  by `chatRunPipeline.ts` when `isStreamAbortError(err)` is true at the
   *  pipeline catch boundary (chatRunPipeline.ts ~4540). Distinct from
   *  `user_cancelled` (intentional abort): this abort is unexpected (e.g.
   *  container restart, runtime abort signal). Retryable — the abort is
   *  typically transient. Attribution: network/transient. */
  stream_aborted: { retryable: true, defaultDelayMs: 5_000 },
  /** Catch-all backstop for runs that reached `completeRun` without a
   *  classified errorCode. Emitted by `runsErrorClassification.ts` when
   *  none of the preceding classifiers matched (errorCode = null at the
   *  `completeRun` call site). This code should be rare — a non-null code
   *  from a more specific classifier should take precedence. Retryable
   *  (conservative: we don't know why it failed). Attribution: platform/unknown. */
  unclassified_failure: { retryable: true, defaultDelayMs: 5_000 },

  // ── Guard / admission infrastructure errors ────────────────────────
  /** Container health check threw unexpectedly inside `runAsyncGuardsParallel`.
   *  Retryable — transient check failure, not a confirmed dead container.
   *  Distinct from `container_dead` (confirmed alive=false after `isContainerAlive`). */
  container_check_error: { retryable: true, defaultDelayMs: 5_000 },

  // ── Guided-intake / question-answer path (chat-ui-tooltips-errors §T1) ──
  /** HTTP 409 from `POST /chat/answer`: the question has already expired or
   *  been superseded on the runner side (`StaleQuestionError`). The
   *  SimpleQuestionCard renders an inline stale notice; NOT retryable —
   *  re-sending the same answer to a gone question would fail again. */
  stale_question: { retryable: false },
  /** HTTP 409 from the atomic clarifier-claim path: another concurrent
   *  request already claimed the clarifier slot (`stale_or_duplicate_answer`
   *  in `chatRunClarifierWaiters.ts`). NOT retryable in-place. */
  stale_or_duplicate_answer: { retryable: false },
  /** HTTP 503 from `POST /chat/answer`: the runner session container is
   *  unavailable and the answer cannot be delivered. The PermissionRequestCard
   *  maps this to its `unreachable` expired-reason variant. NOT retryable
   *  in-place — the session must recover independently. */
  destination_unreachable: { retryable: false },
} as const;

export type ChatErrorCode = keyof typeof CHAT_ERROR_CODES;

/**
 * All timeout-family codes produced by the FSM settlement paths in
 * `runner-service/src/chatRunState.ts`. Use this set when you need to
 * ask "is this a timeout?" without enumerating every code by hand.
 * Does NOT include `provider_timeout` (deprecated FSM alias; still
 * emitted by `classifyStreamError` for provider-text-classified timeouts).
 */
export const FSM_TIMEOUT_CODES = [
  'awaiting_output_timeout',
  'stream_stall_timeout',
  'question_timeout',
  'enrichment_timeout',
  'child_wait_timeout',
  'http_timeout',
  'hard_timeout',
] as const satisfies readonly ChatErrorCode[];

export type FsmTimeoutCode = (typeof FSM_TIMEOUT_CODES)[number];

// ---------------------------------------------------------------------------
// Error origin / severity / action axis (2026-04-20)
// ---------------------------------------------------------------------------
//
// The user asked to clearly distinguish "our infrastructure broke" from
// "the LLM provider returned an error" from "the user needs to act" from
// "the network glitched". The existing `presentationGroup()` in
// `src/lib/chat/errorClassification.ts` maps codes to 5 visual buckets
// but does NOT attribute blame. This axis is orthogonal and drives the
// banner copy, color, and action button.
//
// The wire stays `errorCode: string` (single field). Origin/severity/action
// are DERIVED client-side from the code via the map below. Runner-side
// classifyStreamError() may also attach `errorStatusCode` + `errorProvider`
// to metadata so the banner can surface "OpenAI returned 403" vs a generic
// "provider error".
//

/** WHO owns the failure. Drives color + language. */
export type ErrorOrigin = 'platform' | 'provider' | 'user' | 'network';

/** Can the error be recovered automatically, by user retry, or not at all? */
export type ErrorSeverity = 'transient' | 'fatal' | 'partial';

/** What the UI should offer the user to do. */
export type ErrorAction =
  | 'retry'              // Simple retry button — same prompt, same model
  | 'switch_model'       // User should pick another model
  | 'top_up'             // User should add credits
  | 'fix_config'         // User should fix settings (auth, provider)
  | 'wait'               // Auto-retry in progress; spinner, no button
  | 'new_chat'           // Start fresh chat (context poisoned)
  | 'contact_support'    // Platform bug worth flagging
  | 'clarify'            // Clarification loop (ClarificationCard)
  | null;

export interface ChatErrorAttribution {
  origin: ErrorOrigin;
  severity: ErrorSeverity;
  action: ErrorAction;
}

/**
 * Map every canonical errorCode to a (origin, severity, action) triple.
 *
 * Rules:
 * - `provider` = LLM/API fault (OpenAI 403, Anthropic rate-limit, etc.).
 *   User is NOT responsible. Language: "OpenAI is having a hiccup…"
 * - `platform` = our runner/container/serve/bridge broke.
 *   User is NOT responsible. Language: "We hit a bug. Incident logged."
 * - `user` = user action needed (top-up credits, re-auth, clarify prompt).
 *   Language: "Please do X to continue."
 * - `network` = connection between user and our edge.
 *   Language: "Connection lost. Reconnecting…"
 *
 * Entries omitted here default to (platform, fatal, retry) — conservative.
 */
export const CHAT_ERROR_ATTRIBUTION: Partial<Record<string, ChatErrorAttribution>> = {
  // ── Provider (LLM/API fault) ──────────────────────────────────────
  provider_forbidden:       { origin: 'provider', severity: 'transient', action: 'retry' },
  provider_overloaded:      { origin: 'provider', severity: 'transient', action: 'wait' },
  provider_error:           { origin: 'provider', severity: 'transient', action: 'wait' },
  provider_timeout:         { origin: 'provider', severity: 'transient', action: 'retry' },
  rate_limited:             { origin: 'provider', severity: 'transient', action: 'wait' },
  model_unavailable:        { origin: 'provider', severity: 'transient', action: 'switch_model' },
  content_filtered:         { origin: 'provider', severity: 'fatal',     action: null },
  provider_invalid_tool_history: { origin: 'provider', severity: 'fatal', action: 'new_chat' },
  // Upstream stalls: transport, serve, and container are all healthy — the
  // model provider itself stopped streaming. Attributing these to `platform`
  // mis-blames our infrastructure for a provider-side hang.
  awaiting_output_timeout:  { origin: 'provider', severity: 'transient', action: 'retry' },
  stream_stall_timeout:     { origin: 'provider', severity: 'transient', action: 'retry' },
  content_progress_timeout: { origin: 'provider', severity: 'transient', action: 'retry' },
  // W4-D5 (2026-04-28): tighter-budget abort for reasoning-marathon-prone
  // models. Action='switch_model' because retry on the same model produces
  // the same marathon — the right escape is a different model.
  reasoning_marathon_aborted: { origin: 'provider', severity: 'transient', action: 'switch_model' },
  // BFA08 (2026-04-22): structured upstream 5xx parsed from SSE error envelope
  // (OpenAI `server_error`, Anthropic `api_error`). Previously these bled into
  // `serve_error` and blamed our infrastructure for a provider outage.
  provider_server_error:    { origin: 'provider', severity: 'transient', action: 'retry' },

  // ── User (action needed) ──────────────────────────────────────────
  auth_failed:              { origin: 'user', severity: 'fatal',     action: 'fix_config' },
  auth_expired:             { origin: 'user', severity: 'fatal',     action: 'fix_config' },
  billing_exceeded:         { origin: 'user', severity: 'fatal',     action: 'top_up' },
  // F1 admission rejection on a depleted balance (rejection_code='insufficient_balance').
  // A user-account state, NOT a platform fault. Was MISSING from this map, so it fell
  // through to the (platform, fatal, retry) default → mis-rendered as "Our infrastructure"
  // + a useless Retry button. Mirror billing_exceeded: user origin + top_up CTA.
  insufficient_balance:     { origin: 'user', severity: 'fatal',     action: 'top_up' },
  context_exceeded:         { origin: 'user', severity: 'fatal',     action: 'new_chat' },
  prompt_too_long:          { origin: 'user', severity: 'fatal',     action: null },
  hard_timeout:             { origin: 'user', severity: 'fatal',     action: 'new_chat' },
  question_timeout:         { origin: 'user', severity: 'fatal',     action: null },
  permission_denied:        { origin: 'user', severity: 'fatal',     action: null },
  permission_timeout:       { origin: 'user', severity: 'fatal',     action: null },
  permission_stale:         { origin: 'user', severity: 'fatal',     action: 'new_chat' },
  permission_unreachable:   { origin: 'platform', severity: 'transient', action: 'wait' },
  permission_response_failed: { origin: 'platform', severity: 'transient', action: 'retry' },
  clarification_required:   { origin: 'user', severity: 'fatal',     action: 'clarify' },
  capability_mismatch:      { origin: 'user', severity: 'fatal',     action: 'switch_model' },
  // W6-E3.3 (2026-04-28): bug_claim bypass with no symptom verified +
  // 0 file changes. The AGENT didn't fix anything; the USER must clarify
  // what bug they actually saw (reproduction steps) before another attempt.
  no_symptom_verified:      { origin: 'user', severity: 'fatal',     action: 'clarify' },
  // B23 agent-action authority-gate denial (denied_input ∈ role/adapter/node_policy/risk).
  // Emitted by `chatRunStreaming.ts` when `gateStreamingToolUse` blocks a tool call
  // (e.g. a `member` role lacks the `apply` capability). A deterministic authorization
  // decision — NOT our infrastructure, and NOT retryable: re-running hits the same gate.
  // Was MISSING from this map, so it fell through to the (platform, transient, retry)
  // default → mis-rendered as "Our infrastructure" + a futile Retry button
  // (dev.bos.pro run 0732afff, 2026-06-08). Mirror permission_denied: user origin, no action.
  action_denied:            { origin: 'user', severity: 'fatal',     action: null },

  // ── Network (between client and our edge) ─────────────────────────
  connection_lost:          { origin: 'network', severity: 'transient', action: 'wait' },
  client_disconnected:      { origin: 'network', severity: 'fatal',     action: 'retry' },
  network_error:            { origin: 'network', severity: 'transient', action: 'retry' },
  http_timeout:             { origin: 'network', severity: 'transient', action: 'retry' },
  transport_error:          { origin: 'network', severity: 'transient', action: 'wait' },
  // W2-2: upstream provider socket dropped mid-stream. `provider` origin
  // (not `network`) because the failure boundary is between runner and
  // the AI provider, not between client and runner. `retry` action
  // because partial content is preserved and the retry has a high
  // chance of success on a fresh socket.
  upstream_socket_drop:     { origin: 'provider', severity: 'transient', action: 'retry' },
  transport_busy:           { origin: 'network', severity: 'transient', action: 'wait' },
  transport_recovery:       { origin: 'network', severity: 'transient', action: 'wait' },

  // ── Platform (our infrastructure broke) ───────────────────────────
  serve_error:              { origin: 'platform', severity: 'transient', action: 'retry' },
  serve_unavailable:        { origin: 'platform', severity: 'transient', action: 'wait' },
  serve_session_generic:    { origin: 'platform', severity: 'transient', action: 'retry' },
  container_dead:           { origin: 'platform', severity: 'transient', action: 'wait' },
  container_recovering:     { origin: 'platform', severity: 'transient', action: 'wait' },
  session_degraded:         { origin: 'platform', severity: 'transient', action: 'wait' },
  session_not_ready:        { origin: 'platform', severity: 'transient', action: 'wait' },
  /**
   * BFA05: silent admission-race wait. `action: null` so the frontend does not
   * render an error banner — the loader stays visible and we re-queue on the
   * next snapshot tick. Not a user-facing failure.
   */
  SESSION_NOT_ADMITTING_YET: { origin: 'platform', severity: 'transient', action: null },
  session_not_found:        { origin: 'platform', severity: 'transient', action: 'retry' },
  // Phase 3 of openspec/changes/hygiene-hibernation-consistency (codex review
  // 2026-05-26 P2 #2): per-reason 404 split. action='retry' for parity with
  // session_not_found — the user can start a new chat, which is the same
  // recovery path. severity='transient' because the underlying session is gone
  // but the user retains all their session-independent context.
  session_evicted_zombie:        { origin: 'platform', severity: 'transient', action: 'retry' },
  session_evicted_idle_timeout:  { origin: 'platform', severity: 'transient', action: 'retry' },
  session_evicted_lru:           { origin: 'platform', severity: 'transient', action: 'retry' },
  session_evicted_stuck_created: { origin: 'platform', severity: 'transient', action: 'retry' },
  session_run_active:       { origin: 'platform', severity: 'transient', action: 'wait' },
  writer_lock_conflict:     { origin: 'platform', severity: 'transient', action: 'wait' },
  ai_preparing:             { origin: 'platform', severity: 'transient', action: 'wait' },
  workspace_initializing:   { origin: 'platform', severity: 'transient', action: 'wait' },
  enrichment_timeout:       { origin: 'platform', severity: 'partial',   action: 'retry' },
  child_wait_timeout:       { origin: 'platform', severity: 'partial',   action: 'retry' },
  premature_done:           { origin: 'platform', severity: 'fatal',     action: 'new_chat' },
  stall_abort:              { origin: 'platform', severity: 'transient', action: 'retry' },
  stall_error:              { origin: 'platform', severity: 'transient', action: 'retry' },
  first_token_delayed:      { origin: 'platform', severity: 'transient', action: 'wait' },
  stream_interrupted:       { origin: 'platform', severity: 'transient', action: 'retry' },
  agent_not_found:          { origin: 'platform', severity: 'fatal',     action: 'contact_support' },
  preflight_error:          { origin: 'platform', severity: 'fatal',     action: 'retry' },
  delegation_circuit_breaker: { origin: 'platform', severity: 'fatal',   action: 'retry' },
  model_delegation_denied:    { origin: 'platform', severity: 'fatal',   action: 'switch_model' },
  invalid_task_args:          { origin: 'platform', severity: 'fatal',   action: 'retry' },
  cqs_required:             { origin: 'platform', severity: 'fatal',     action: 'contact_support' },
  cqs_invalid_response:     { origin: 'platform', severity: 'fatal',     action: 'contact_support' },
  server_error:             { origin: 'platform', severity: 'transient', action: 'retry' },

  // ── BFA01 (2026-04-21): typed authorization 403s from runner ──────
  // These mirror AuthorizationErrorCode in runner-service/src/auth.ts.
  // `action: null` — ErrorBanner renders a bespoke workspace-switch CTA
  // when code === 'scope_mismatch' (not a new taxonomy action; just a
  // local render branch like ClarificationCard for clarification_required).
  scope_mismatch:           { origin: 'user', severity: 'fatal', action: null },
  surface_key_not_found:    { origin: 'user', severity: 'fatal', action: 'retry' },
  no_owner_surface:         { origin: 'user', severity: 'fatal', action: 'contact_support' },
  no_role_on_surface:       { origin: 'user', severity: 'fatal', action: 'contact_support' },
  session_forbidden:        { origin: 'user', severity: 'fatal', action: 'contact_support' },

  // ── Reaper / lifecycle kill (chat-pipeline-error-correctness §1.5) ──
  // Reaper killed the run (idle_kill / container_oom / cleanup_job /
  // restart_lost). Platform-side cause, fatal in-place — the user-intent
  // SI / dispatch state is gone. Recovery is starting a new chat.
  reaper_killed:            { origin: 'platform', severity: 'fatal', action: 'new_chat' },

  // ── Stream abort / unclassified backstop (chat-error-classification-recovery) ──
  // stream_aborted: unexpected AbortError from runtime/container (not user cancel).
  // Attributing to 'network' because the abort signal typically originates from a
  // dropped transport connection; retryable with standard backoff.
  stream_aborted:           { origin: 'network', severity: 'transient', action: 'retry' },
  // unclassified_failure: catch-all backstop when no specific code was set.
  // Platform-side: we don't know the root cause, so conservatively attribute to
  // platform and offer retry. severity='transient' because the default assumption
  // is that a retry has a reasonable chance of succeeding.
  unclassified_failure:     { origin: 'platform', severity: 'transient', action: 'retry' },
};

/** Default attribution for codes not in the map above. Conservative:
 *  assume our bug and offer retry. Never mis-attribute to user. */
export const CHAT_ERROR_ATTRIBUTION_DEFAULT: ChatErrorAttribution = {
  origin: 'platform',
  severity: 'transient',
  action: 'retry',
};

/**
 * Pure lookup: `errorCode` → (origin, severity, action).
 * Unknown codes default to (platform, transient, retry).
 */
export function attributeError(code: string | null | undefined): ChatErrorAttribution {
  if (!code) return CHAT_ERROR_ATTRIBUTION_DEFAULT;
  return CHAT_ERROR_ATTRIBUTION[code] ?? CHAT_ERROR_ATTRIBUTION_DEFAULT;
}

/**
 * Type guard: check if a string is a known ChatErrorCode.
 */
export function isChatErrorCode(code: string): code is ChatErrorCode {
  return code in CHAT_ERROR_CODES;
}

/**
 * Type guard: check if a code is a (non-deprecated) FSM timeout family code.
 */
export function isFsmTimeoutCode(code: string): code is FsmTimeoutCode {
  return (FSM_TIMEOUT_CODES as readonly string[]).includes(code);
}

/**
 * chat-pipeline-error-correctness §1.5.2 — single retryability oracle.
 *
 * Returns `true` iff `code` is a known ChatErrorCode whose registry entry
 * has `retryable: true`. Unknown codes return `false` (forward-compat:
 * new upstream codes are non-retryable by default until added to the
 * taxonomy). `undefined` / `null` / empty string return `false`.
 *
 * Consumers (useFirstRun, useMessageStream, errorClassification, the
 * runner-side classifier) MUST consult this helper instead of inlining
 * `CHAT_ERROR_CODES[code]?.retryable === false` patterns. Enforces a
 * single source of retryability truth.
 */
export function isRetryable(code: ChatErrorCode | string | null | undefined): boolean {
  if (!code) return false;
  const entry = (CHAT_ERROR_CODES as Record<string, ChatErrorCodeMeta | undefined>)[code];
  return entry?.retryable === true;
}
