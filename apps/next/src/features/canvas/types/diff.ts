import type { RunDiff, RunDiffFile, RunDiffFileStatus } from '@/core/runs'

// Diff screen types (canvas `diff` screen). Domain seam types (`RunDiff*`) are DEFINED in the access
// layer (`@/core/runs`) — a lower layer than features — so they're re-exported by `types/index.ts`,
// not redefined here. This module owns only the diff screen's component prop contracts + the local
// display preference. (Kept in a sibling file because `types/index.ts` is owned by the canvas-shell.)

/** Screen-wide line-diff layout preference, applied to every file's renderer at once. */
export type DiffStyle = 'unified' | 'split'

/** The diff screen — header + file list + states. Fed a `runId`; reads via `useRunDiff`. */
export interface DiffScreenProps {
  /** The run whose changes to show. Null/undefined → the empty "no run selected" state. */
  runId?: string | null
}

/** Header strip — file count + Σ± + unified/split toggle + collapse-all/expand-all. */
export interface DiffHeaderProps {
  fileCount: number
  totalAdditions: number
  totalDeletions: number
  diffStyle: DiffStyle
  onDiffStyleChange: (s: DiffStyle) => void
  /** True when every file is expanded → the toggle offers "Collapse all"; else "Expand all". */
  allExpanded: boolean
  onToggleAll: () => void
  /** Compact width forces unified + disables the split option (split needs width). */
  compact?: boolean
}

/** One collapsible file row — `Disclosure` trigger (path + status + ± Chips) wrapping the diff body. */
export interface DiffFileRowProps {
  file: RunDiffFile
  diffStyle: DiffStyle
  isExpanded: boolean
}

/** The ONLY `@pierre/diffs` wrapper — renders the line-level body for one file. */
export interface DiffFileBodyProps {
  file: RunDiffFile
  diffStyle: DiffStyle
}

export type { RunDiff, RunDiffFile, RunDiffFileStatus }
