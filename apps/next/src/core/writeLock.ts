import { supabase } from './supabase'

// Write-lock subscription seam. Polls the runs table for a specific project to determine whether
// a chat run is currently active. The write-lock prevents concurrent agent submissions (ADR 0035
// admission control). This module is framework-agnostic — the React hook in features/shell wraps
// it with useEffect + cleanup.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WriteLockState {
  projectId: string
  locked: boolean
  runId: string | null
}

// ── Subscription ──────────────────────────────────────────────────────────────

/**
 * Poll the runs table for a project every `intervalMs` (default 3000ms) and invoke `onUpdate`
 * with the current write-lock state. Returns an unsubscribe function that clears the interval.
 *
 * A project is write-locked when any run has status in ['running', 'streaming', 'pending'].
 * Errors are swallowed — the lock is reported as `false` (unlocked) so the UI does not block
 * indefinitely on a transient DB hiccup.
 */
export function subscribeWriteLock(
  projectId: string,
  onUpdate: (state: WriteLockState) => void,
  intervalMs = 3000,
): () => void {
  let active = true

  async function poll(): Promise<void> {
    if (!active) return
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('id, status')
        .eq('project_id', projectId)
        .in('status', ['running', 'streaming', 'pending'])
        .limit(1)

      if (!active) return

      if (error || !data) {
        onUpdate({ projectId, locked: false, runId: null })
        return
      }

      const first = data[0] ?? null
      onUpdate({
        projectId,
        locked: first !== null,
        runId: first ? (first.id as string) : null,
      })
    } catch {
      if (active) {
        onUpdate({ projectId, locked: false, runId: null })
      }
    }
  }

  // Fire immediately, then on each interval tick.
  void poll()
  const handle = setInterval(() => void poll(), intervalMs)

  return () => {
    active = false
    clearInterval(handle)
  }
}
