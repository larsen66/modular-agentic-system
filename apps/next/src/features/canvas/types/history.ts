import type {
  RunHistoryEntry,
  RunDetail,
  RunStatus,
  RunFileChange,
  ProposalBucket,
} from '@/core/history'

// Canvas `history` screen types. The DOMAIN types (RunHistoryEntry, RunDetail, RunStatus,
// ProposalBucket, RunFileChange) are DEFINED in the access layer (`@/core/history`) — a lower layer
// than features — so they are re-exported here (mirrors how `types/index.ts` re-exports the preview
// snapshot type). This file adds only the screen/component PROP contracts.

export type { RunHistoryEntry, RunDetail, RunStatus, RunFileChange, ProposalBucket }

/** The history screen — master/detail over a project's run history. READ-ONLY (no apply/rollback). */
export interface HistoryScreenProps {
  projectId?: string | null
  /** Optional chat scope; omit to list every run for the project. */
  chatId?: string | null
  /** Deep-link to the canvas `diff` view for a run's changes (parent canvas-shell wires it). */
  onViewDiff?: (runId: string) => void
  /**
   * Deep-link out to the governed OPS proposal (`/ops/proposals/:id`). Optional — when omitted the
   * screen navigates via `window.location.assign(buildOpsProposalPath(id))`. Apply/rollback is OPS.
   */
  onOpenInOps?: (proposalId: string) => void
}

/** The run timeline list (left region) — single-selection ListBox over the runs. */
export interface RunTimelineProps {
  runs: RunHistoryEntry[]
  selectedRunId: string | null
  onSelect: (runId: string) => void
}

/** One row in the timeline (run index/time + status + ± + proposal chips). */
export interface RunTimelineRowProps {
  run: RunHistoryEntry
  /** 1-based, newest = highest (display "Run #N"). */
  index: number
}

/** The selected-run detail card (right region) — metadata + files table + deep-link CTAs. */
export interface RunDetailCardProps {
  detail: RunDetail
  /** "View diff" → canvas diff view; disabled when the run changed no files. */
  onViewDiff?: () => void
  /** "Open in OPS" → governed proposal; disabled when no proposal exists. */
  onOpenInOps?: () => void
}

/** Per-file changed list inside the detail card. */
export interface RunFilesTableProps {
  files: RunFileChange[]
}
