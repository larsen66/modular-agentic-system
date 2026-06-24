// ChatHost — the shell-facing entry for the chat area. Reads the active chat selection from the
// cross-cutting UI store (set by the Explorer), resolves its runner session, and mounts the
// ChatPaneScreen. Renders an empty state when nothing is selected. This is what the app shell hosts
// in the Stage/content area (registered via registerScreen('chat')).

import { useEffect, useState } from 'react'
import { useUiStore } from '@/state/uiStore'
import { fetchChatSession } from '@/core/chats'
import { ChatPaneScreen } from './ChatPaneScreen'
import { EmptyState } from '@/shared/EmptyState'
import { useChatStrings } from '../../i18n'

export function ChatHost() {
  const t = useChatStrings()
  const activeChatId = useUiStore((s) => s.activeChatId)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setSessionId(undefined)
    if (!activeChatId) return
    fetchChatSession(activeChatId)
      .then((r) => { if (!cancelled) setSessionId(r.sessionId ?? undefined) })
      .catch(() => { if (!cancelled) setSessionId(undefined) })
    return () => { cancelled = true }
  }, [activeChatId])

  if (!activeChatId) {
    return <EmptyState title={t.host.noChat} description={t.host.noChatBody} />
  }

  // `key` remounts the pane on chat switch so per-chat state (draft, transcript) resets cleanly.
  return <ChatPaneScreen key={activeChatId} chatId={activeChatId} sessionId={sessionId} />
}
