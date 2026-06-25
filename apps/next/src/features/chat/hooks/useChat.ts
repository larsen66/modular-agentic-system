import { useCallback, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ChatStatus } from 'ai'
import { useUiStore } from '@/state/uiStore'
import { createChat, createProject, ensureMainChat, resolveBootstrapTarget } from '@/core/projects'
import { newId, buildRunSelection } from '@/core/chat'
import { ownerSurfaceKey, projectChatPath, SURFACE_KEY_QS, WORKSPACE_QS } from '@/lib/route'
import { useChatMessages, useChatStore, useRunState } from '../state/chatStore'
import { useSelectionStore } from '../state/selectionStore'
import { useChatSession, type ChatSessionState } from './useChatSession'
import { useChatModels, type ChatModelsState } from './useChatModels'
import { useChatRun } from './useChatRun'
import { useChatHistory } from './useChatHistory'
import { TERMINAL_PHASES, type ChatMessage, type RunState } from '../types'

// The chat controller: URL is the authority for project/chat; this wires session + run + models +
// the bootstrap ("create project from prompt") + the provisioning send-queue. ChatPane consumes it.

// Prompts queued before the session can accept them (bootstrap + provisioning), keyed by chatId.
const pendingPrompts = new Map<string, string>()

// Kernel run target → send opts. 'auto' is omitted so the kernel falls back to its own default
// (PI when a model key is present). The selector writes harness/environment/topology into the
// selection store.
function kernelTarget(sel: { harness: string; environment: string; topology: string }): {
  harness?: string
  environment?: string
  topology?: string
} {
  return {
    ...(sel.harness && sel.harness !== 'auto' ? { harness: sel.harness } : {}),
    ...(sel.environment && sel.environment !== 'auto' ? { environment: sel.environment } : {}),
    ...(sel.topology && sel.topology !== 'auto' ? { topology: sel.topology } : {}),
  }
}

export interface ChatController {
  projectId: string | null
  chatId: string | null
  hostWorkspaceId: string | null
  surfaceKey: string | null
  messages: ChatMessage[]
  /** An existing chat's durable history is still loading — hold the conversation layout, not landing. */
  historyLoading: boolean
  run: RunState
  status: ChatStatus
  session: ChatSessionState
  models: ChatModelsState
  send: (text: string) => void
  stop: () => void
  answer: (requestID: string, answers: string[][]) => void
  respondToPermission: (permissionId: string, action: 'allow_once' | 'allow' | 'deny') => void
}

export function useChat(): ChatController {
  const params = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const activeOrgId = useUiStore((s) => s.activeOrgId)

  const projectId = params.projectId ?? null
  const chatId = params.chatId ?? null
  const hostWorkspaceId = sp.get(WORKSPACE_QS)
  const surfaceKey = sp.get(SURFACE_KEY_QS)

  const session = useChatSession({
    projectId,
    chatId,
    hostWorkspaceId,
    surfaceKey,
    enabled: Boolean(projectId),
  })
  const messages = useChatMessages(chatId)
  const run = useRunState(chatId)
  const models = useChatModels({
    sessionId: session.sessionId,
    status: session.status,
    runtime: session.runtime,
    chatAccepting: session.chatAccepting,
    projectId,
    hostWorkspaceId,
    surfaceKey,
  })
  const { send, stop, answer, respondToPermission } = useChatRun({
    sessionId: session.sessionId,
    chatId,
  })

  // Hydrate the durable transcript when an existing chat is opened (so it doesn't look "new").
  const runActive = run.phase !== 'idle' && !TERMINAL_PHASES.has(run.phase)
  const { loading: historyLoading } = useChatHistory({ chatId, projectId, runActive })

  // Publish the resolved sessionId to the global store so the canvas pane can subscribe to the
  // live preview without prop-drilling through Stage (which doesn't own the session lifecycle).
  const setActiveSessionId = useUiStore((s) => s.setActiveSessionId)
  const sessionId = session.sessionId
  useEffect(() => {
    console.log('[useChat] activeSessionId →', sessionId)
    setActiveSessionId(sessionId)
    return () => { setActiveSessionId(null) }
  }, [sessionId, setActiveSessionId])

  // Project selected but no chat in the URL → ensure the main chat, then redirect to it.
  useEffect(() => {
    if (!projectId || chatId || !hostWorkspaceId) return
    let cancelled = false
    ensureMainChat(projectId, hostWorkspaceId)
      .then(({ chatId: mainId }) => {
        if (cancelled) return
        navigate(
          projectChatPath(projectId, {
            chatId: mainId,
            workspaceId: hostWorkspaceId,
            surfaceKey: surfaceKey ?? ownerSurfaceKey(projectId, hostWorkspaceId),
          }),
          { replace: true },
        )
      })
      .catch(() => {
        /* leave URL as-is; the empty state still renders */
      })
    return () => {
      cancelled = true
    }
  }, [projectId, chatId, hostWorkspaceId, surfaceKey, navigate])

  // Send a queued prompt once the session can accept it (bootstrap + provisioning queue).
  useEffect(() => {
    if (!chatId || !session.chatAccepting) return
    const queued = pendingPrompts.get(chatId)
    if (queued) {
      pendingPrompts.delete(chatId)
      const sel = useSelectionStore.getState()
      const selection = buildRunSelection({
        modelMode: sel.modelMode,
        explicitModelRef: sel.explicitModelRef,
        agentMode: sel.agentMode,
        selectedAgentId: sel.selectedAgentId,
        effortId: sel.effortId,
      })
      void send(queued, { skipAppend: true, projectId: projectId ?? undefined, chatId, ...selection, ...kernelTarget(sel) })
    }
  }, [chatId, session.chatAccepting, send])

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Landing destination: an explicitly-picked app, or (on the home composer) a brand-new app
      // bootstrapped from the prompt. When a project is already in context and no app was picked,
      // fall through to the normal in-chat send below.
      const target = useSelectionStore.getState().landingTarget
      if (target || !projectId) {
        try {
          let pid: string
          let workspaceId: string
          let cid: string
          if (target) {
            pid = target.projectId
            workspaceId = target.workspaceId
            ;({ chatId: cid } = await createChat({
              projectId: pid,
              workspaceId,
              kind: 'branch',
              title: trimmed.slice(0, 60),
            }))
          } else {
            ;({ workspaceId } = await resolveBootstrapTarget(activeOrgId))
            ;({ projectId: pid } = await createProject({
              workspaceId,
              name: trimmed.slice(0, 60),
              prompt: trimmed,
            }))
            ;({ chatId: cid } = await ensureMainChat(pid, workspaceId))
          }
          pendingPrompts.set(cid, trimmed)
          useChatStore.getState().appendUserMessage(cid, trimmed, `user-${newId()}`)
          useChatStore.getState().setRun(cid, { status: 'submitted', phase: 'preparing' })
          useSelectionStore.getState().setLandingTarget(null)
          navigate(
            projectChatPath(pid, {
              chatId: cid,
              workspaceId,
              surfaceKey: ownerSurfaceKey(pid, workspaceId),
            }),
          )
        } catch {
          /* composer stays editable; a toast layer can surface the failure later */
        }
        return
      }

      if (!chatId) return

      // Session still provisioning → optimistic user turn + queue; the effect sends when ready.
      if (!session.chatAccepting) {
        useChatStore.getState().appendUserMessage(chatId, trimmed, `user-${newId()}`)
        useChatStore.getState().setRun(chatId, { status: 'submitted', phase: 'preparing' })
        pendingPrompts.set(chatId, trimmed)
        return
      }

      const sel = useSelectionStore.getState()
      const selection = buildRunSelection({
        modelMode: sel.modelMode,
        explicitModelRef: sel.explicitModelRef,
        agentMode: sel.agentMode,
        selectedAgentId: sel.selectedAgentId,
        effortId: sel.effortId,
      })
      void send(trimmed, { projectId, chatId, ...selection, ...kernelTarget(sel) })
    },
    [projectId, chatId, session.chatAccepting, activeOrgId, navigate, send],
  )

  const status: ChatStatus = !projectId ? 'ready' : run.status

  return {
    projectId,
    chatId,
    hostWorkspaceId,
    surfaceKey,
    messages,
    historyLoading,
    run,
    status,
    session,
    models,
    send: handleSend,
    stop,
    answer,
    respondToPermission,
  }
}
