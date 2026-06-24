import { useQuery } from '@tanstack/react-query'
import { getRunDiff, type RunDiff } from '@/core/runs'

// Run-diff query — fetched once per `runId` (TanStack Query, keyed `['run-diff', runId]`) so
// collapsing/expanding files or flipping unified/split never refetches (design §6 optimization).
// The access-layer op (`@/core/runs`) owns all runner/Supabase access; this hook is the feature-side
// state adapter only.

export interface UseRunDiffResult {
  data: RunDiff | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useRunDiff(runId: string | null | undefined): UseRunDiffResult {
  const query = useQuery({
    queryKey: ['run-diff', runId],
    queryFn: ({ signal }) => getRunDiff(runId as string, signal),
    enabled: Boolean(runId),
    staleTime: Infinity, // a run's diff is immutable once produced
  })

  return {
    data: query.data,
    isLoading: query.isLoading && Boolean(runId),
    isError: query.isError,
    refetch: () => void query.refetch(),
  }
}
