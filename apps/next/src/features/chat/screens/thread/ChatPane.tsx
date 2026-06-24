import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageList } from '@/components/agent-elements/message-list'
import { InputBar } from '@/components/agent-elements/input-bar'
import type {
  QuestionAnswer,
  QuestionConfig,
} from '@/components/agent-elements/question/question-prompt'
import type { SuggestionItem } from '@/components/agent-elements/input/suggestions'
import { TextShimmer } from '@/components/agent-elements/text-shimmer'
import { useUiStore } from '@/state/uiStore'
import { projectChatPath, SURFACE_KEY_QS, WORKSPACE_QS } from '@/lib/route'
import { CHAT_DRAG_TYPE } from '@/lib/dragTypes'
import { useChatStrings } from '../../i18n'
import { useChat } from '../../hooks/useChat'
import { useChatStore } from '../../state/chatStore'
import { useOrgBalance, useResolvedOrgId, LOW_BALANCE } from '../../hooks/useOrgBalance'
import { useChatHeader } from '../../hooks/useChatHeader'
import { KernelTargetSwitcher } from '../../components/KernelTargetSwitcher'
import { AppSwitcher } from '../../components/AppSwitcher'

export function ChatPane() {
  const t = useChatStrings()
  const chat = useChat()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [lowBalanceDismissed, setLowBalanceDismissed] = useState(false)
  const [paneDragOver, setPaneDragOver] = useState(false)
  const openChatTab = useUiStore((s) => s.openChatTab)
  const updateChatTabTitle = useUiStore((s) => s.updateChatTabTitle)

  const handlePaneDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(CHAT_DRAG_TYPE)) {
      e.preventDefault()
      setPaneDragOver(true)
    }
  }

  const handlePaneDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setPaneDragOver(false)
    const raw = e.dataTransfer.getData(CHAT_DRAG_TYPE)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as {
        type: string
        chatId: string
        projectId: string
        workspaceId?: string
        surfaceKey?: string
        title?: string
      }
      if (data.type !== 'chat' || !data.chatId || !data.projectId) return
      openChatTab({
        chatId: data.chatId,
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        surfaceKey: data.surfaceKey,
        title: data.title ?? null,
      })
      navigate(
        projectChatPath(data.projectId, {
          chatId: data.chatId,
          workspaceId: data.workspaceId,
          surfaceKey: data.surfaceKey,
        }),
      )
    } catch {
      // ignore malformed drag data
    }
  }
  const activeOrgId = useResolvedOrgId()
  const headerMeta = useChatHeader()
  const messageAreaRef = useRef<HTMLDivElement>(null)

  // Auto-register this chat as a tab the moment we have a projectId + chatId.
  useEffect(() => {
    if (!chat.projectId || !chat.chatId) return
    openChatTab({
      chatId: chat.chatId,
      projectId: chat.projectId,
      workspaceId: sp.get(WORKSPACE_QS) ?? undefined,
      surfaceKey: sp.get(SURFACE_KEY_QS) ?? undefined,
      title: headerMeta.chatTitle ?? null,
    })
  // intentionally omits headerMeta — only fires when chatId/projectId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.chatId, chat.projectId])

  // Keep the stored tab title in sync once the query resolves.
  useEffect(() => {
    if (!chat.chatId || !headerMeta.chatTitle) return
    updateChatTabTitle(chat.chatId, headerMeta.chatTitle)
  }, [chat.chatId, headerMeta.chatTitle, updateChatTabTitle])

  const handleSend = useCallback(
    ({ content }: { role: 'user'; content: string }) => {
      chat.send(content)
      setDraft('')
    },
    [chat],
  )

  const suggestions = useMemo<SuggestionItem[]>(
    () => t.suggestions.map((label, i) => ({ id: `suggestion-${i}`, label })),
    [t.suggestions],
  )

  const pq = chat.run.pendingQuestion
  const perm = chat.run.pendingPermission

  const PERMISSION_ACTIONS = ['allow_once', 'allow', 'deny'] as const
  const permissionBar = perm
    ? {
        id: perm.permissionId,
        questions: [
          {
            kind: 'single' as const,
            title: permissionPrompt(perm),
            options: [
              { id: '0', label: 'Allow once' },
              { id: '1', label: 'Allow always' },
              { id: '2', label: 'Deny' },
            ],
          },
        ],
        submitLabel: 'Respond',
        onSubmit: (answer: QuestionAnswer) => {
          const idx = answer.kind === 'text' ? 2 : Number(answer.selectedIds?.[0] ?? '2')
          chat.respondToPermission(perm.permissionId, PERMISSION_ACTIONS[idx] ?? 'deny')
        },
      }
    : undefined

  const intakeBar = pq
    ? {
        id: pq.requestID,
        questions: pq.questions.map<QuestionConfig>((q) => ({
          kind: q.kind,
          title: q.prompt,
          options: q.options?.map((label, i) => ({ id: String(i), label })),
        })),
        onSubmit: (answer: QuestionAnswer) => {
          const q = pq.questions[0]
          const values =
            answer.kind === 'text'
              ? [answer.text ?? '']
              : (answer.selectedIds ?? []).map((id) => q?.options?.[Number(id)] ?? id)
          chat.answer(pq.requestID, [values])
        },
      }
    : undefined

  const questionBar = permissionBar ?? intakeBar

  const isEmpty = chat.messages.length === 0 && !chat.historyLoading
  const provisioningLabel = useProvisioningLabel(chat)

  // Scroll-to-bottom on chat area resize (width change from resizing the preview).
  useLayoutEffect(() => {
    const el = messageAreaRef.current
    if (!el) return
    let lastW = el.clientWidth
    let timer = 0
    let raf = 0
    const scrollToBottom = () => {
      const list = el.querySelector<HTMLElement>('.an-message-list')
      if (!list) return
      cancelAnimationFrame(raf)
      const start = list.scrollTop
      const dist = list.scrollHeight - list.clientHeight - start
      if (dist <= 1) return
      const DURATION = 280
      let t0 = 0
      const step = (ts: number) => {
        if (!t0) t0 = ts
        const p = Math.min((ts - t0) / DURATION, 1)
        list.scrollTop = start + dist * (1 - Math.pow(1 - p, 3))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w === lastW) return
      lastW = w
      window.clearTimeout(timer)
      timer = window.setTimeout(scrollToBottom, 120)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [isEmpty])

  const { data: balance } = useOrgBalance(activeOrgId)
  const rejection = chat.run.rejection
  const clearRejection = useCallback(() => {
    if (chat.chatId) useChatStore.getState().setRun(chat.chatId, { rejection: null })
  }, [chat.chatId])
  const topUp = useCallback((orgId?: string | null) => {
    window.location.assign(orgId ? `/settings/org/${orgId}/billing` : '/settings/billing')
  }, [])

  let infoBar: NonNullable<Parameters<typeof InputBar>[0]['infoBar']> | undefined
  if (rejection) {
    infoBar =
      rejection.code === 'insufficient_balance'
        ? {
            title: t.balance.title,
            description: rejection.balance
              ? `${t.balance.body} ${rejection.balance.current} ${t.balance.credits} ${t.balance.available} · ${rejection.balance.threshold} ${t.balance.credits} ${t.balance.required}.`
              : rejection.message || t.balance.body,
            onClose: clearRejection,
            action: { label: t.balance.topUp, onClick: () => topUp(rejection.balance?.orgId ?? activeOrgId) },
          }
        : { title: t.balance.blockedTitle, description: rejection.message, onClose: clearRejection }
  } else if (typeof balance === 'number' && balance <= 0) {
    infoBar = {
      title: t.balance.emptyTitle,
      description: t.balance.emptyBody,
      action: { label: t.balance.topUp, onClick: () => topUp(activeOrgId) },
    }
  } else if (typeof balance === 'number' && balance < LOW_BALANCE && !lowBalanceDismissed) {
    infoBar = {
      title: t.balance.lowTitle,
      description: `${balance} ${t.balance.credits} ${t.balance.lowBody}`,
      onClose: () => setLowBalanceDismissed(true),
      action: { label: t.balance.topUp, onClick: () => topUp(activeOrgId) },
    }
  }

  const input = (
    <InputBar
      status={chat.status}
      value={draft}
      onChange={setDraft}
      onSend={handleSend}
      onStop={() => chat.stop()}
      placeholder={t.composerPlaceholder}
      suggestions={isEmpty ? suggestions : []}
      questionBar={questionBar}
      infoBar={infoBar}
      leftActions={<KernelTargetSwitcher />}
    />
  )

  // Provisioning label shown inside the content area, top-left.
  const provisioningEl = provisioningLabel ? (
    <div className="pointer-events-none absolute left-3 top-2 z-20">
      <TextShimmer as="span" className="text-xs font-normal">
        {provisioningLabel}
      </TextShimmer>
    </div>
  ) : null

  const dropProps = {
    onDragOver: handlePaneDragOver,
    onDragLeave: () => setPaneDragOver(false),
    onDrop: handlePaneDrop,
  }

  if (isEmpty) {
    return (
      <div className="relative flex h-full min-h-0 flex-col" {...dropProps}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
          {provisioningEl}
          <div className="w-full max-w-2xl">
            {/* Landing state: pick which app this new conversation starts in. Sits above the
                composer, indented to line up with the input box's rounded left edge (px-3, same as
                the InputBar's outer padding) — outside the input box itself. */}
            <div className="mb-2 flex px-3">
              <AppSwitcher currentProjectId={chat.projectId} />
            </div>
            {input}
          </div>
        </div>
        {paneDragOver && <DropOverlay />}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" {...dropProps}>
      <div ref={messageAreaRef} className="relative min-h-0 flex-1">
        <MessageList
          messages={chat.messages as unknown as import('ai').UIMessage[]}
          status={chat.status}
          suppressQuestionTool={Boolean(questionBar)}
          className="h-full [&>div]:max-w-none [&>div]:pt-6 [&>div]:px-6"
        />
        {/* Slim gradient: softens the hard edge where messages meet the tab strip. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background/70 to-transparent" />
        {provisioningEl}
      </div>
      {input}
      {paneDragOver && <DropOverlay />}
    </div>
  )
}

function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 bg-foreground/5" />
  )
}

function permissionPrompt(perm: { toolName?: string; filePath?: string; patterns?: string[] }): string {
  const target = perm.filePath ?? perm.patterns?.join(', ')
  const tool = perm.toolName ?? 'a tool'
  return target
    ? `Allow ${tool} to access ${target}?`
    : `Allow the agent to run ${tool}?`
}

function useProvisioningLabel(chat: ReturnType<typeof useChat>): string | null {
  const t = useChatStrings()
  if (!chat.projectId) return null
  if (chat.session.chatAccepting) return null
  const stage = chat.session.stage
  if (!stage) return null
  if (stage === 'error_exhausted') return t.provisioning.errorExhausted
  return t.provisioning[stage] ?? t.provisioning.generic
}
