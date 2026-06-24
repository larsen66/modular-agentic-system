import { supabase } from './supabase'

// Run/version-history access-layer seam (canvas `history` screen). READ-ONLY provenance: it reads
// the REAL run/version data that the run pipeline already writes — `runs`, `version_intents`
// (run → proposal linkage), `ops_proposals` (governed-proposal status), and per-run
// `summary.enrichment.diff` (files-changed ±). RLS-respecting (mirrors the `core/explorer.ts`
// membership-first pattern — a direct select returns only rows the caller may read).
//
// This module NEVER applies or rolls back anything. Apply/rollback is an OPS-domain governed action;
// `buildOpsProposalPath` only produces the deep-link the screen navigates to (C16 honesty boundary).
//
// Contract sources (keep in sync):
//   - `supabase/migrations/20260220300000_runs_history.sql` — runs(id, project_id, session_id,
//     status ∈ {started,running,succeeded,failed}, summary jsonb, created_at, started_at)
//   - `supabase/migrations/20260409200000_version_intents.sql` — version_intents(run_id, proposal_id)
//   - `supabase/migrations/20260221130100_ops_proposals.sql` — ops_proposals(id, status ∈
//     {pending,approved,applied,rejected}, title)
//   - run `summary.enrichment.diff` — Array<{file, additions, deletions}> (src/types/chat.ts
//     EnrichmentData.diff). Reuses the legacy `partialRunRecovery` proposal-bucket mapping.

/** Live `runs.status` values. */
export type RunStatus = 'started' | 'running' | 'succeeded' | 'failed'

/** Live `ops_proposals.status` values. */
export type OpsProposalStatus = 'pending' | 'approved' | 'applied' | 'rejected'

/**
 * Governed-proposal bucket for a run (carried from legacy `partialRunRecovery.categorizeProposalStatus`
 * + the "not started" case): `applied → completed`, `pending|approved → in_progress`,
 * `rejected → rejected`, no proposal → `notStarted`.
 */
export type ProposalBucket = 'completed' | 'in_progress' | 'rejected' | 'notStarted'

/** One file's change counts from a run's `summary.enrichment.diff`. */
export interface RunFileChange {
  file: string
  additions: number
  deletions: number
}

/** A single run row in the history timeline (newest-first). */
export interface RunHistoryEntry {
  id: string
  status: RunStatus
  /** Best display timestamp: created_at ?? started_at. */
  createdAt: string | null
  chatId: string | null
  sessionId: string | null
  /** Files changed in this run + the ± totals (derived from summary.enrichment.diff). */
  filesChanged: number
  additions: number
  deletions: number
  /** The governed proposal linked to this run via version_intents, if any. */
  proposalId: string | null
  proposalBucket: ProposalBucket
}

/** Detail of one run (lazy-fetched on selection): metadata + per-file diff summary. */
export interface RunDetail {
  id: string
  status: RunStatus
  createdAt: string | null
  chatId: string | null
  sessionId: string | null
  /** Model the run used, if recorded in summary (CONTRACT: optional — summary shape is loose). */
  model: string | null
  files: RunFileChange[]
  additions: number
  deletions: number
  proposalId: string | null
  proposalBucket: ProposalBucket
}

const RUN_FETCH_LIMIT = 50

// ── Pure helpers ──

/** Map a live proposal status → display bucket (carries legacy partialRunRecovery mapping). */
export function bucketProposalStatus(status: OpsProposalStatus | null | undefined): ProposalBucket {
  switch (status) {
    case 'applied':
      return 'completed'
    case 'pending':
    case 'approved':
      return 'in_progress'
    case 'rejected':
      return 'rejected'
    default:
      return 'notStarted'
  }
}

/** Extract the files-changed array from a loose `summary` jsonb (summary.enrichment.diff). */
function extractDiff(summary: unknown): RunFileChange[] {
  // CONTRACT: the run pipeline writes files-changed under summary.enrichment.diff; tolerate a
  // top-level summary.diff fallback. Unknown shapes degrade to an empty list (no throw).
  const s = (summary ?? {}) as Record<string, unknown>
  const enrichment = (s.enrichment ?? {}) as Record<string, unknown>
  const raw = (enrichment.diff ?? s.diff) as unknown
  if (!Array.isArray(raw)) return []
  return raw
    .map((d) => {
      const row = (d ?? {}) as Record<string, unknown>
      const file = typeof row.file === 'string' ? row.file : null
      if (!file) return null
      return {
        file,
        additions: Number(row.additions ?? 0) || 0,
        deletions: Number(row.deletions ?? 0) || 0,
      }
    })
    .filter((d): d is RunFileChange => d !== null)
}

function extractModel(summary: unknown): string | null {
  const s = (summary ?? {}) as Record<string, unknown>
  const model = s.model ?? s.modelId ?? (s.agent as Record<string, unknown> | undefined)?.model
  return typeof model === 'string' ? model : null
}

function totals(files: RunFileChange[]): { additions: number; deletions: number } {
  return files.reduce(
    (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
    { additions: 0, deletions: 0 },
  )
}

// ── Operations (over core/supabase, RLS-respecting) ──

/**
 * List runs for a project (optionally a single chat), newest-first, capped at 50. Joins each run's
 * `version_intents` → `ops_proposals` in two round-trips (one IN-query each) so a row knows whether
 * a governed proposal exists and its bucket. RLS scopes the result to readable rows.
 */
export async function listRuns(projectId: string, chatId?: string | null): Promise<RunHistoryEntry[]> {
  let query = supabase
    .from('runs')
    .select('id, status, summary, created_at, started_at, chat_id, session_id')
    .eq('project_id', projectId)
  if (chatId) query = query.eq('chat_id', chatId)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(RUN_FETCH_LIMIT)
  if (error) throw new Error(`listRuns failed: ${error.message}`)

  const runs = data ?? []
  const runIds = runs.map((r) => r.id as string)

  // run → proposalId via version_intents (most recent linked proposal per run).
  const proposalByRun = new Map<string, string>()
  if (runIds.length > 0) {
    const { data: intents, error: viErr } = await supabase
      .from('version_intents')
      .select('run_id, proposal_id')
      .in('run_id', runIds)
    if (viErr) throw new Error(`listRuns version_intents join failed: ${viErr.message}`)
    for (const vi of intents ?? []) {
      const runId = vi.run_id as string | null
      const proposalId = vi.proposal_id as string | null
      if (runId && proposalId && !proposalByRun.has(runId)) proposalByRun.set(runId, proposalId)
    }
  }

  // proposalId → status via ops_proposals.
  const statusByProposal = new Map<string, OpsProposalStatus>()
  const proposalIds = Array.from(new Set(proposalByRun.values()))
  if (proposalIds.length > 0) {
    const { data: proposals, error: opErr } = await supabase
      .from('ops_proposals')
      .select('id, status')
      .in('id', proposalIds)
    if (opErr) throw new Error(`listRuns ops_proposals join failed: ${opErr.message}`)
    for (const p of proposals ?? []) {
      statusByProposal.set(p.id as string, p.status as OpsProposalStatus)
    }
  }

  return runs.map((row) => {
    const files = extractDiff(row.summary)
    const t = totals(files)
    const proposalId = proposalByRun.get(row.id as string) ?? null
    const proposalStatus = proposalId ? statusByProposal.get(proposalId) ?? null : null
    return {
      id: row.id as string,
      status: (row.status as RunStatus) ?? 'started',
      createdAt: (row.created_at as string) ?? (row.started_at as string) ?? null,
      chatId: (row.chat_id as string) ?? null,
      sessionId: (row.session_id as string) ?? null,
      filesChanged: files.length,
      additions: t.additions,
      deletions: t.deletions,
      proposalId,
      proposalBucket: bucketProposalStatus(proposalStatus),
    }
  })
}

/**
 * Fetch one run's detail: metadata + the per-file diff from `summary.enrichment.diff`, plus its
 * governed-proposal bucket (same join as `listRuns`, scoped to one run). RLS-respecting.
 */
export async function getRunDetail(runId: string): Promise<RunDetail> {
  const { data, error } = await supabase
    .from('runs')
    .select('id, status, summary, created_at, started_at, chat_id, session_id')
    .eq('id', runId)
    .maybeSingle()
  if (error) throw new Error(`getRunDetail failed: ${error.message}`)
  if (!data) throw new Error(`getRunDetail: run ${runId} not found`)

  const files = extractDiff(data.summary)
  const t = totals(files)

  const { data: intents, error: viErr } = await supabase
    .from('version_intents')
    .select('proposal_id')
    .eq('run_id', runId)
  if (viErr) throw new Error(`getRunDetail version_intents failed: ${viErr.message}`)
  const proposalId = (intents ?? []).map((v) => v.proposal_id as string | null).find(Boolean) ?? null

  let proposalStatus: OpsProposalStatus | null = null
  if (proposalId) {
    const { data: proposal, error: opErr } = await supabase
      .from('ops_proposals')
      .select('status')
      .eq('id', proposalId)
      .maybeSingle()
    if (opErr) throw new Error(`getRunDetail ops_proposals failed: ${opErr.message}`)
    proposalStatus = (proposal?.status as OpsProposalStatus) ?? null
  }

  return {
    id: data.id as string,
    status: (data.status as RunStatus) ?? 'started',
    createdAt: (data.created_at as string) ?? (data.started_at as string) ?? null,
    chatId: (data.chat_id as string) ?? null,
    sessionId: (data.session_id as string) ?? null,
    model: extractModel(data.summary),
    files,
    additions: t.additions,
    deletions: t.deletions,
    proposalId,
    proposalBucket: bucketProposalStatus(proposalStatus),
  }
}

/**
 * Deep-link path to the governed OPS proposal (apply/rollback live there, NOT here). Mirrors the
 * legacy `partialRunRecovery.buildRecoveryViewPath`. The screen NAVIGATES to this; it never calls OPS.
 */
export function buildOpsProposalPath(proposalId: string): string {
  return `/ops/proposals/${proposalId}`
}
