import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronsDown, ChevronsUp } from 'lucide-react'
import { ScrollShadow } from '@heroui/react'
import { InputBar } from '@/components/agent-elements/input-bar'
import { MessageList } from '@/components/agent-elements/message-list'
import { TextShimmer } from '@/components/agent-elements/text-shimmer'
import { useUiStore } from '@/state/uiStore'
import { useChatMessages, useRunState } from '../state/chatStore'
import { useChatRun } from '../hooks/useChatRun'
import { KernelTargetSwitcher } from './KernelTargetSwitcher'
import { useChatStrings } from '../i18n'
import { TERMINAL_PHASES } from '../types'
import type { RunState, ChatMessage } from '../types'

// Reads the active chat state from the store directly — does NOT call useChat() which would spin
// up a second useChatSession, write activeSessionId, and nuke the preview on unmount.

const MAX_CONTENT_H = 300

const PHASE_LABEL: Partial<Record<string, string>> = {
  preparing: 'Preparing…',
  dispatching: 'Starting…',
  streaming: 'Generating…',
  verifying: 'Verifying…',
  waiting_children: 'Running agent…',
  waiting_input: 'Waiting for input…',
}

type LiveEvent = { label: string; running: boolean } | null

function deriveEvent(messages: ChatMessage[], run: RunState): LiveEvent {
  const phase = run.phase
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const parts = (msg.parts as unknown as Array<Record<string, unknown>>) ?? []
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j]
      const type = p.type as string
      if (!type.startsWith('tool-') || type === 'tool-Thinking') continue
      const label = type.slice(5)
      const state = p.state as string | undefined
      const running = state === 'input-available' || state === 'input-streaming'
      return { label, running }
    }
    break
  }
  const phaseLabel = PHASE_LABEL[phase]
  if (phaseLabel) return { label: phaseLabel, running: true }
  return null
}

function useLiveEvent(messages: ChatMessage[], run: RunState): LiveEvent {
  return useMemo(() => deriveEvent(messages, run), [messages, run])
}

function useLastMessageSnippet(messages: ChatMessage[]): string | null {
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role !== 'assistant') continue
      const parts = (msg.parts as unknown as Array<Record<string, unknown>>) ?? []
      for (const p of parts) {
        if (p.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
          return p.text.replace(/\s+/g, ' ').trim()
        }
      }
    }
    return null
  }, [messages])
}

export function PreviewChatOverlay() {
  const [chatExpanded, setChatExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const msgContainerRef = useRef<HTMLDivElement>(null)
  const t = useChatStrings()

  // Read active chat from URL + store — no new session creation.
  const params = useParams()
  const chatId = params.chatId ?? null
  const activeSessionId = useUiStore((s) => s.activeSessionId)

  const messages = useChatMessages(chatId)
  const run = useRunState(chatId)
  const { send, stop } = useChatRun({ sessionId: activeSessionId, chatId })

  const liveEvent = useLiveEvent(messages, run)
  const lastSnippet = useLastMessageSnippet(messages)

  // Auto-expand when the run settles.
  const phase = run.phase
  useEffect(() => {
    if (TERMINAL_PHASES.has(phase as never)) setChatExpanded(true)
  }, [phase])

  // Scroll to bottom after expand animation settles.
  useEffect(() => {
    if (!chatExpanded) return
    const el = msgContainerRef.current
    if (!el) return
    const id = window.setTimeout(() => { el.scrollTop = el.scrollHeight }, 310)
    return () => window.clearTimeout(id)
  }, [chatExpanded])

  // Collapse when clicking anywhere on the canvas outside the overlay.
  useEffect(() => {
    if (!chatExpanded) return
    const onPointerDown = (e: PointerEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setChatExpanded(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [chatExpanded])

  const handleSend = useCallback(
    ({ content }: { role: 'user'; content: string }) => {
      void send(content)
      setDraft('')
    },
    [send],
  )

  const eventNode = !chatExpanded ? (
    liveEvent
      ? liveEvent.running
        ? <TextShimmer as="span" duration={1.5}>{liveEvent.label}</TextShimmer>
        : <span className="text-an-foreground-muted/80">{liveEvent.label}</span>
      : lastSnippet
        ? <span className="text-an-foreground-muted/50">{lastSnippet}</span>
        : null
  ) : null

  return (
    <div
      ref={overlayRef}
      className="absolute bottom-3 left-1/2 z-20 flex flex-col overflow-hidden rounded-an-input-border-radius bg-an-background-tertiary shadow-md"
      style={{ width: '60%', maxWidth: 640, transform: 'translateX(-50%)' }}
    >
      <ScrollShadow
        ref={msgContainerRef}
        style={{
          maxHeight: chatExpanded ? MAX_CONTENT_H : 0,
          transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <MessageList
          messages={messages as unknown as import('ai').UIMessage[]}
          status={run.status}
          className="!flex-none [&>div]:max-w-none [&>div]:px-4 [&>div]:pt-3 [&_[aria-hidden=true]]:!min-h-0 [&_[aria-hidden=true]]:!hidden"
        />
        {chatExpanded && (
          <button
            type="button"
            onClick={() => setChatExpanded(false)}
            className="sticky bottom-2 right-2 float-right z-10 inline-flex items-center justify-center w-6 h-6 rounded-md text-an-foreground-muted/70 hover:text-an-foreground hover:bg-an-background-secondary"
            aria-label="Collapse"
          >
            <ChevronsDown className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
      </ScrollShadow>

      <InputBar
        className="!p-0"
        status={run.status}
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={stop}
        placeholder={t.composerPlaceholder}
        leftActions={<KernelTargetSwitcher />}
        infoBar={!chatExpanded ? {
          persistent: true,
          descriptionNode: eventNode,
          onClose: () => setChatExpanded(true),
          closeIcon: <ChevronsUp className="w-3.5 h-3.5" strokeWidth={2} />,
        } : undefined}
      />
    </div>
  )
}
