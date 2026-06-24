import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSession,
  getSession,
  isChatAccepting,
  mapProvisioningStage,
  type RunnerSessionStatus,
  type SessionProvisioningStage,
  type SessionResponse,
} from '@/core/runnerSession'

// Drives the runner container session for the active project/chat: create → poll until chat-ready.
// Recreated from legacy useSession (poll cadence simplified — no session WS push in v1). The runner
// reuses/adopts an existing session, so re-creating on chat switch is safe.

export interface ChatSessionState {
  sessionId: string | null
  status: RunnerSessionStatus | null
  runtime: string | null
  chatAccepting: boolean
  stage: SessionProvisioningStage | null
  errorExhausted: boolean
  error: string | null
  retry: () => void
}

const INITIAL: Omit<ChatSessionState, 'retry'> = {
  sessionId: null,
  status: null,
  runtime: null,
  chatAccepting: false,
  stage: null,
  errorExhausted: false,
  error: null,
}

export function useChatSession(input: {
  projectId: string | null
  chatId: string | null
  hostWorkspaceId: string | null
  surfaceKey: string | null
  enabled: boolean
}): ChatSessionState {
  const { projectId, chatId, hostWorkspaceId, surfaceKey, enabled } = input
  const [state, setState] = useState(INITIAL)
  const [retryToken, setRetryToken] = useState(0)
  const versionRef = useRef(-1)

  const retry = useCallback(() => setRetryToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled || !projectId) {
      setState(INITIAL)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let sessionId: string | null = null
    versionRef.current = -1
    setState({ ...INITIAL, stage: 'creating' })

    const apply = (resp: SessionResponse): boolean => {
      const lc = resp.lifecycle
      if (lc && lc.stateVersion <= versionRef.current) {
        // stale snapshot — keep current state, but report whether we're done
        return state.chatAccepting || state.errorExhausted
      }
      if (lc) versionRef.current = Math.max(versionRef.current, lc.stateVersion)
      const stage = mapProvisioningStage(lc) ?? (resp.status === 'ready' ? 'ready' : 'creating')
      const accepting = isChatAccepting(resp)
      const exhausted = stage === 'error_exhausted'
      if (!cancelled) {
        setState({
          sessionId: resp.id,
          status: lc?.status ?? resp.status,
          runtime: (resp.runtime as string) ?? null,
          chatAccepting: accepting,
          stage,
          errorExhausted: exhausted,
          error: lc?.errorMessage ?? null,
        })
      }
      return accepting || exhausted
    }

    const poll = async () => {
      if (cancelled || !sessionId) return
      try {
        const resp = await getSession(sessionId)
        if (cancelled) return
        const done = apply(resp)
        if (!done) timer = setTimeout(poll, 3000)
      } catch {
        if (!cancelled) timer = setTimeout(poll, 5000)
      }
    }

    ;(async () => {
      try {
        console.log('[useChatSession] createSession →', { projectId, chatId, hostWorkspaceId, surfaceKey })
        const resp = await createSession({ projectId, chatId, hostWorkspaceId, surfaceKey })
        if (cancelled) return
        sessionId = resp.id
        console.log('[useChatSession] session created', { id: resp.id, status: resp.status, chatAccepting: resp.chatAccepting })
        const done = apply(resp)
        if (!done) timer = setTimeout(poll, 2000)
      } catch (err) {
        console.error('[useChatSession] createSession failed', err)
        if (!cancelled) {
          setState({ ...INITIAL, error: err instanceof Error ? err.message : 'Session failed' })
        }
      }
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chatId, hostWorkspaceId, surfaceKey, enabled, retryToken])

  return { ...state, retry }
}
