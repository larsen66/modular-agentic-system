import { useEffect } from 'react'
import { fetchChatHistory } from '@/core/chat'
import { useChatStore } from '../state/chatStore'
import { historyRowsToMessages } from '../adapters/historyMapper'

// Module-level dedupe of in-flight history fetches, keyed by chatId. Module (not a ref) so it
// survives React StrictMode's mount→unmount→remount in dev — a ref would reset per instance and a
// double mount would either double-fetch or, worse, mark the chat "resolved" before its rows land.
const inFlight = new Set<string>()

// Hydrates a chat's durable transcript when it's opened. Without this, navigating to an existing chat
// shows the empty "start a new chat" state because the in-memory store has no rows for that chatId —
// the SSE stream is only the LIVE lane. Loads from `chat_messages` (core.fetchChatHistory) once per
// chat, and `hydrateMessages` refuses to clobber a chat that already has live/optimistic messages.
//
// Returns `{ loading }`: true while an existing chat is opening and NOTHING has populated its
// transcript yet (the store has no entry for the chatId). Derived from store presence — not a local
// flag — so it's correct on a cold page load and under StrictMode. Lets the pane hold the
// conversation layout (input pinned to the bottom) instead of flashing the centered landing state.
export function useChatHistory(params: {
  chatId: string | null
  projectId: string | null
  runActive: boolean
}): { loading: boolean } {
  const { chatId, projectId, runActive } = params
  // Reactive: has this chat's transcript been populated at all (hydrated, or live/optimistic rows)?
  const populated = useChatStore((s) => (chatId ? s.byChat[chatId] !== undefined : false))

  useEffect(() => {
    if (!chatId || !projectId) return
    // Already populated (hydrated before, or a run is streaming its live transcript) → nothing to do.
    if (runActive) return
    if (useChatStore.getState().byChat[chatId] !== undefined) return
    if (inFlight.has(chatId)) return

    inFlight.add(chatId)
    fetchChatHistory(chatId, projectId)
      .then((rows) => {
        // `hydrateMessages` is idempotent (won't clobber live rows) and a store write is safe even
        // after unmount, so no per-mount cancellation flag is needed — which is what StrictMode broke.
        useChatStore.getState().hydrateMessages(chatId, historyRowsToMessages(rows))
      })
      .catch(() => {
        /* leave the chat unpopulated so the next mount retries the load */
      })
      .finally(() => {
        inFlight.delete(chatId)
      })
  }, [chatId, projectId, runActive])

  // Loading while we're inside a project but not yet showing a populated chat: either the URL has no
  // chatId yet (the controller is resolving/creating the main chat → about to redirect) OR the chat's
  // transcript hasn't been populated. Both must hold the conversation layout, never the centered
  // landing. The home composer (no project) is never "loading" — it's the real landing state.
  const loading = Boolean(projectId && (!chatId || !populated))
  return { loading }
}
