import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Button } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/state/uiStore'
import { ownerSurfaceKey, projectChatPath } from '@/lib/route'
import { useProjectChats } from '../../hooks/useProjectChats'
import { useShellStrings } from '../../i18n'
import { useRenameProject, useDeleteProject } from '../../hooks/useExplorerMutations'
import { useCreateChat } from '../../hooks/useCreateChat'
import type { ProjectNode } from '../../types'
import type { ProjectStatus, ChatAttentionState } from '@/core/status'
import { AppRow } from './AppRow'
import { ChatRow } from './ChatRow'
import { ExplorerEmptyState } from './ExplorerEmptyState'
import { TreeSkeleton } from './TreeSkeleton'
import { RenameModal } from './RenameModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { ProjectStatusDot } from './ProjectStatusDot'

// "Show more" cap — first 5 chats per project, then a one-shot expand-to-all (legacy parity).
const CHAT_CAP = 5

// A project (app/folder) branch: the row selects the node (→ Stage selection); its chevron lazily
// loads + reveals the project's chats (cap 5 + "Show more"). Folders use a folder icon.
export function ProjectBranch({
  project,
  workspaceId,
  projectStatus,
}: {
  project: ProjectNode
  workspaceId: string
  projectStatus?: ProjectStatus | null
}) {
  const t = useShellStrings()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const activeNodeId = useUiStore((s) => s.activeNodeId)
  const activeChatId = useUiStore((s) => s.activeChatId)
  const surfaceKey = ownerSurfaceKey(project.id, workspaceId)

  // Auto-expand when this project becomes the active node (e.g. navigating to a chat via URL or tab).
  useEffect(() => {
    if (activeNodeId === project.id) setExpanded(true)
  }, [activeNodeId, project.id])

  const chatsQuery = useProjectChats(project.id, workspaceId, expanded)
  const chats = chatsQuery.data ?? []

  // Scroll the active chat row into view in the Explorer whenever it changes and is in this project.
  // Small timeout lets React flush the DOM after expansion/load before we query the element.
  useEffect(() => {
    if (!activeChatId || !expanded) return
    if (!chats.some((c) => c.id === activeChatId)) return
    const id = window.setTimeout(() => {
      document
        .querySelector(`[data-chat-id="${activeChatId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [activeChatId, expanded, chats])
  const visible = showAll ? chats : chats.slice(0, CHAT_CAP)
  const hidden = Math.max(chats.length - CHAT_CAP, 0)

  // Mutations
  const renameProject = useRenameProject(workspaceId)
  const deleteProject = useDeleteProject(workspaceId)
  const createChat = useCreateChat(project.id, workspaceId)

  // Flying dot: one absolutely-positioned dot that slides between chats in this project.
  // Cross-project or first-reveal → snaps (no slide). Within-project → animates.
  const chatsRef = useRef<HTMLDivElement>(null)
  const flyingDotRef = useRef<HTMLSpanElement>(null)
  const prevChatIdRef = useRef<string | null>(null)

  // True only when the branch is open AND the active chat belongs to this project.
  const activeChatInThisProject = expanded && chats.some((c) => c.id === activeChatId)

  useLayoutEffect(() => {
    const container = chatsRef.current
    const dot = flyingDotRef.current
    if (!container || !dot) return

    if (!activeChatInThisProject || !activeChatId) {
      dot.style.transition = 'opacity 120ms ease'
      dot.style.opacity = '0'
      prevChatIdRef.current = null
      return
    }

    // .xr-chat-dot-ref is the size-3.5 placeholder span inside NodeRow (leaf rows only).
    const rowEl = container.querySelector(`[data-chat-id="${activeChatId}"]`)
    const anchorEl = rowEl?.querySelector('.xr-chat-dot-ref')
    if (!rowEl || !anchorEl) {
      dot.style.opacity = '0'
      return
    }

    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchorEl.getBoundingClientRect()
    const dotRect = dot.getBoundingClientRect()

    // Center the flying dot at the anchor span's center.
    const cx = anchorRect.left - containerRect.left + anchorRect.width / 2
    const cy = anchorRect.top - containerRect.top + anchorRect.height / 2
    const x = cx - dotRect.width / 2
    const y = cy - dotRect.height / 2

    const prevWasHere = prevChatIdRef.current !== null

    if (prevWasHere) {
      // Same-project switch → slide.
      dot.style.transition = 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
    } else {
      // First reveal or cross-project → snap, no animation.
      dot.style.transition = 'none'
      dot.getBoundingClientRect() // force reflow so transition:none applies before transform
    }

    dot.style.transform = `translate(${x}px, ${y}px)`
    dot.style.opacity = '1'

    if (!prevWasHere) {
      // Re-arm slide transition for the next within-project change.
      requestAnimationFrame(() => {
        if (flyingDotRef.current) {
          flyingDotRef.current.style.transition =
            'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
        }
      })
    }

    prevChatIdRef.current = activeChatId
  }, [activeChatId, activeChatInThisProject, chats, expanded])

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <div className="relative flex items-center">
          <AppRow
            project={project}
            selected={activeNodeId === project.id}
            expanded={expanded}
            onPress={() => {
              setExpanded((v) => !v)
              // Don't re-navigate when we're ALREADY in this app's chat — navigating to the bare project
              // route drops the chatId, which makes the controller re-resolve the main chat (landing flash
              // → chat reload). Already here → just toggle the chat list. Otherwise navigate to the project
              // (the controller resolves its main chat); the URL is the selection authority.
              const alreadyHere = activeNodeId === project.id && Boolean(activeChatId)
              if (!alreadyHere) {
                navigate(projectChatPath(project.id, { workspaceId, surfaceKey }))
              }
            }}
            onCreateChat={() => {
              createChat.mutate(undefined, {
                onSuccess: ({ chatId }) => {
                  setExpanded(true)
                  navigate(
                    projectChatPath(project.id, { chatId, workspaceId, surfaceKey }),
                  )
                },
              })
            }}
            onMenuAction={(id) => {
              if (id === 'rename') setRenameOpen(true)
              if (id === 'remove') setDeleteOpen(true)
            }}
          />
          {/* Status dot — shown to the right of the row's label, overlaid like a badge */}
          {projectStatus ? (
            <ProjectStatusDot
              health={projectStatus.health}
              writeLocked={projectStatus.writeLocked}
            />
          ) : null}
        </div>
        {expanded ? (
          <div ref={chatsRef} className="relative flex flex-col gap-0.5">
            {/* Flying dot: slides between chats in this project. Hidden by default;
                positioned and revealed by the useLayoutEffect above. */}
            <span
              ref={flyingDotRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 size-1.5 rounded-full bg-accent"
              style={{ opacity: 0, transform: 'translate(0, 0)' }}
            />
            {chatsQuery.isLoading ? <TreeSkeleton rows={2} indent={2} /> : null}
            {chatsQuery.isError ? (
              <ExplorerEmptyState
                message={t.explorer.empty.error}
                onRetry={() => void chatsQuery.refetch()}
                retryLabel={t.explorer.retry}
              />
            ) : null}
            {!chatsQuery.isLoading && !chatsQuery.isError
              ? visible.map((chat) => {
                  // Derive chat attention state from project's active chat (simple heuristic).
                  const chatAttention: ChatAttentionState =
                    projectStatus?.activeChatId === chat.id &&
                    (projectStatus.health === 'running' || projectStatus.health === 'preparing')
                      ? 'running'
                      : 'none'
                  return (
                    // data-chat-id: used by the flying dot effect to locate and measure this row.
                    <div key={chat.id} data-chat-id={chat.id}>
                      <ChatRow
                        chat={chat}
                        selected={activeChatId === chat.id}
                        chatStatus={chatAttention}
                        suppressDot={activeChatInThisProject}
                        projectId={project.id}
                        workspaceId={workspaceId}
                        onSelect={() => {
                          navigate(
                            projectChatPath(project.id, {
                              chatId: chat.id,
                              workspaceId,
                              surfaceKey,
                            }),
                          )
                        }}
                      />
                    </div>
                  )
                })
              : null}
            {!showAll && hidden > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                className="justify-start"
                style={{ paddingLeft: 2 * 12 + 12 }}
                onPress={() => setShowAll(true)}
              >
                {t.explorer.showMore} ({hidden})
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <RenameModal
        isOpen={renameOpen}
        currentName={project.name}
        entityLabel="app"
        onClose={() => setRenameOpen(false)}
        onSave={(name) => renameProject.mutateAsync({ id: project.id, name })}
      />

      <DeleteConfirmModal
        isOpen={deleteOpen}
        name={project.name}
        entityLabel="app"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteProject.mutateAsync(project.id)}
      />
    </>
  )
}
