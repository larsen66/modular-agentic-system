import { useQuery } from '@tanstack/react-query'
import { listRuns, getRunDetail, type RunHistoryEntry, type RunDetail } from '@/core/history'

// Server state for the history screen (react-query over the `core/history` seam). Two queries:
// the run list (eager once a project is known) and the selected run's detail (lazy — only fetched
// when a row is selected, keyed by runId so switching runs swaps cleanly). Scoped local to the
// history screen composition (ARCHITECTURE §3 — a screen-local hook, not a shared feature hook).

export function useRunList(projectId: string | null | undefined, chatId?: string | null) {
  return useQuery<RunHistoryEntry[]>({
    queryKey: ['canvas', 'history', 'runs', projectId ?? null, chatId ?? null],
    queryFn: () => listRuns(projectId as string, chatId ?? undefined),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  })
}

export function useRunDetail(runId: string | null) {
  return useQuery<RunDetail>({
    queryKey: ['canvas', 'history', 'runDetail', runId],
    queryFn: () => getRunDetail(runId as string),
    enabled: Boolean(runId),
    staleTime: 30_000,
  })
}
