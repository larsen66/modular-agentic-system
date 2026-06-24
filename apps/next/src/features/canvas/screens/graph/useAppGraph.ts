import { useEffect, useState } from 'react'
import { fetchAppGraph, type AppGraph } from '@/core/appGraph'
import type { GraphViewState } from '../../types/graph'

// The graph truth hook — fetches the app-structure graph from the `core/appGraph` seam and derives the
// honest view-state (loading / empty / error / no_session / populated). Plain useState/useEffect (the
// island has no react-query); aborts on unmount/identity change. NEVER returns a fabricated graph — an
// empty result maps to `empty`, a missing project to `no_session` (legacy honesty rule).

export interface UseAppGraphResult {
  state: GraphViewState
  graph: AppGraph | null
  error: string | null
  /** Manual refetch (Retry button / run-complete). */
  refresh: () => void
}

export function useAppGraph(projectId: string | null | undefined, sessionId?: string | null): UseAppGraphResult {
  const [graph, setGraph] = useState<AppGraph | null>(null)
  const [state, setState] = useState<GraphViewState>(projectId ? 'loading' : 'no_session')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    // Fetch-on-input-change with a synchronous reset to loading / no-session before the async load —
    // the standard data-hook pattern (clear the stale graph + show the loader as the project changes).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!projectId) {
      setGraph(null)
      setState('no_session')
      setError(null)
      return
    }
    let cancelled = false
    setState('loading')
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchAppGraph(projectId, sessionId)
      .then((g) => {
        if (cancelled) return
        setGraph(g)
        setState(g.nodes.length === 0 ? 'empty' : 'populated')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setGraph(null)
        setError(err instanceof Error ? err.message : 'Failed to load graph')
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [projectId, sessionId, nonce])

  return { state, graph, error, refresh: () => setNonce((n) => n + 1) }
}
