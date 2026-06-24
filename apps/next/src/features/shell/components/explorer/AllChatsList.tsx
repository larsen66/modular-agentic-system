import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/state/uiStore'
import { ownerSurfaceKey, projectChatPath } from '@/lib/route'
import { useProjectChats } from '../../hooks/useProjectChats'
import { useShellStrings } from '../../i18n'
import { ChatRow } from './ChatRow'
import { ExplorerEmptyState } from './ExplorerEmptyState'
import { TreeSkeleton } from './TreeSkeleton'

// The Chats view: a flat chat list for the active project (legacy "All Chats" was project-scoped
// despite the name). With no project selected, an honest empty-state asks the user to pick one.
// (A truly cross-project recent-chats feed is a follow-up — see screens/explorer.md §5 #21.)
export function AllChatsList() {
  const t = useShellStrings()
  const navigate = useNavigate()
  const activeNodeId = useUiStore((s) => s.activeNodeId)
  const activeChatId = useUiStore((s) => s.activeChatId)

  const chatsQuery = useProjectChats(activeNodeId, null, Boolean(activeNodeId))

  if (!activeNodeId) return <ExplorerEmptyState message={t.explorer.empty.chatsTab} />
  if (chatsQuery.isLoading) return <TreeSkeleton rows={4} />
  if (chatsQuery.isError)
    return (
      <ExplorerEmptyState
        message={t.explorer.empty.error}
        onRetry={() => void chatsQuery.refetch()}
        retryLabel={t.explorer.retry}
      />
    )

  const chats = chatsQuery.data ?? []
  if (chats.length === 0) return <ExplorerEmptyState message={t.explorer.empty.chats} />

  return (
    <div className="flex flex-col gap-0.5">
      {chats.map((chat) => (
        <ChatRow
          key={chat.id}
          chat={chat}
          depth={0}
          projectId={activeNodeId}
          workspaceId={chat.workspaceId ?? ''}
          selected={activeChatId === chat.id}
          onSelect={() => {
            if (!activeNodeId) return
            const workspaceId = chat.workspaceId ?? undefined
            navigate(
              projectChatPath(activeNodeId, {
                chatId: chat.id,
                workspaceId,
                surfaceKey: workspaceId ? ownerSurfaceKey(activeNodeId, workspaceId) : undefined,
              }),
            )
          }}
        />
      ))}
    </div>
  )
}
