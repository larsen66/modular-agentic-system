import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import { useRenameChat, useDeleteChat } from '../../hooks/useExplorerMutations'
import type { ChatNode } from '../../types'
import type { ChatAttentionState } from '@/core/status'
import { CHAT_DRAG_TYPE } from '@/lib/dragTypes'
import { NodeRow } from './NodeRow'
import { RenameModal } from './RenameModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { ChatStatusDot } from './ChatStatusDot'

// A chat leaf row (in the tree or the flat Chats list). Selecting it sets the active chat; the "⋯"
// menu carries the chat edit actions (rename / branch / delete). No "+" — chats have no children.
export function ChatRow({
  chat,
  selected,
  depth = 2,
  chatStatus,
  suppressDot,
  projectId,
  workspaceId,
  onSelect,
}: {
  chat: ChatNode
  selected: boolean
  depth?: number
  chatStatus?: ChatAttentionState
  suppressDot?: boolean
  projectId: string
  workspaceId: string
  onSelect: () => void
}) {
  const t = useShellStrings()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const renameChat = useRenameChat(projectId, workspaceId)
  const deleteChat = useDeleteChat(projectId, workspaceId)

  const dragPayload = JSON.stringify({
    type: 'chat',
    chatId: chat.id,
    projectId,
    workspaceId: workspaceId || undefined,
    title: chat.name,
  })

  return (
    <>
      <div
        className="relative flex items-center"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(CHAT_DRAG_TYPE, dragPayload)
          e.dataTransfer.effectAllowed = 'link'
        }}
      >
        <NodeRow
          depth={depth}
          icon={<MessageSquare className="size-4 text-muted" />}
          label={chat.name}
          selected={selected}
          suppressDot={suppressDot}
          onPress={onSelect}
          menuItems={[
            { id: 'rename', label: t.explorer.actions.rename },
            { id: 'branch', label: t.explorer.actions.branch },
            { id: 'remove', label: t.explorer.actions.remove, danger: true },
          ]}
          onMenuAction={(id) => {
            if (id === 'rename') setRenameOpen(true)
            if (id === 'remove') setDeleteOpen(true)
            // 'branch' — deferred, not yet implemented
          }}
        />
        {chatStatus && chatStatus !== 'none' ? (
          <ChatStatusDot attention={chatStatus} />
        ) : null}
      </div>

      <RenameModal
        isOpen={renameOpen}
        currentName={chat.name}
        entityLabel="chat"
        onClose={() => setRenameOpen(false)}
        onSave={(title) => renameChat.mutateAsync({ id: chat.id, title })}
      />

      <DeleteConfirmModal
        isOpen={deleteOpen}
        name={chat.name}
        entityLabel="chat"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteChat.mutateAsync(chat.id)}
      />
    </>
  )
}
