import { useCanvasStrings } from '../../i18n'
import type { RunDiffFileStatus } from '../../types/diff'

// Typed accessor for the diff screen's i18n slice (`t.diff.*`). The canonical EN/DE maps live in the
// canvas i18n catalog (`i18n/{en,de}.ts`, owned by the canvas-shell) under the `diff` namespace; this
// hook reads `useCanvasStrings().diff` and returns it with a local EN fallback so the screen renders
// correctly even before/while the catalog gains the keys (and stays type-safe here without mutating
// the shared CanvasStrings type). When the catalog ships `diff`, this fallback is simply unused.

export interface DiffStrings {
  filesChanged: (n: number) => string
  unified: string
  split: string
  splitNeedsWidth: string
  collapseAll: string
  expandAll: string
  contentUnavailable: string
  status: Record<RunDiffFileStatus, string>
  noRun: { title: string; description: string }
  empty: { title: string; description: string }
  error: { title: string; description: string; retry: string }
}

const EN_FALLBACK: DiffStrings = {
  filesChanged: (n) => `${n} file${n === 1 ? '' : 's'} changed`,
  unified: 'Unified',
  split: 'Split',
  splitNeedsWidth: 'Split view needs more width',
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',
  contentUnavailable: 'Content unavailable',
  status: { added: 'Added', modified: 'Modified', deleted: 'Deleted', renamed: 'Renamed' },
  noRun: { title: 'No run selected', description: 'Select a run to see the file changes it made.' },
  empty: { title: 'No changes', description: 'This run made no file changes.' },
  error: { title: 'Couldn’t load changes', description: 'The diff for this run couldn’t be loaded.', retry: 'Retry' },
}

export function useDiffStrings(): DiffStrings {
  const t = useCanvasStrings() as unknown as { diff?: Partial<DiffStrings> }
  const d = t.diff
  if (!d) return EN_FALLBACK
  return {
    ...EN_FALLBACK,
    ...d,
    status: { ...EN_FALLBACK.status, ...(d.status ?? {}) },
    noRun: { ...EN_FALLBACK.noRun, ...(d.noRun ?? {}) },
    empty: { ...EN_FALLBACK.empty, ...(d.empty ?? {}) },
    error: { ...EN_FALLBACK.error, ...(d.error ?? {}) },
    filesChanged: d.filesChanged ?? EN_FALLBACK.filesChanged,
  }
}
