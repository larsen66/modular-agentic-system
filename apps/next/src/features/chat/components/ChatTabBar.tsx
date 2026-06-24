import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import { Plus, X } from 'lucide-react'
import { useUiStore, type ChatTab } from '@/state/uiStore'
import { ownerSurfaceKey, projectChatPath } from '@/lib/route'
import { CHAT_DRAG_TYPE } from '@/lib/dragTypes'
import { createChat } from '@/core/projects'
import { useChatStore } from '../state/chatStore'

export { CHAT_DRAG_TYPE }

const TAB_REORDER_TYPE = 'application/x-tab-reorder'

export function ChatTabBar() {
  const navigate = useNavigate()
  const tabs = useUiStore((s) => s.chatTabs)
  const activeChatId = useUiStore((s) => s.activeChatId)
  const activeNodeId = useUiStore((s) => s.activeNodeId)
  const closeChatTab = useUiStore((s) => s.closeChatTab)
  const openChatTab = useUiStore((s) => s.openChatTab)
  const reorderChatTabs = useUiStore((s) => s.reorderChatTabs)

  const [dragOver, setDragOver] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])

  // JS-managed hover so we can clear it immediately on drag end.
  // This avoids relying on CSS :hover which stays stuck after HTML5 drag-drop
  // because the browser doesn't fire mouseleave when a drag ends.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const resetDragState = () => {
    flushSync(() => {
      setDraggingIndex(null)
      setDropIndex(null)
      setHoveredIndex(null) // clear any stuck hover
    })
    dropIndexRef.current = null
  }

  useEffect(() => {
    window.addEventListener('dragend', resetDragState)
    return () => window.removeEventListener('dragend', resetDragState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToTab = (tab: ChatTab) => {
    navigate(
      projectChatPath(tab.projectId, {
        chatId: tab.chatId,
        workspaceId: tab.workspaceId,
        surfaceKey: tab.surfaceKey,
      }),
    )
  }

  const handleClose = (chatId: string) => {
    const idx = tabs.findIndex((t) => t.chatId === chatId)
    closeChatTab(chatId)
    if (chatId === activeChatId) {
      const remaining = tabs.filter((t) => t.chatId !== chatId)
      const next = remaining[idx] ?? remaining[idx - 1]
      if (next) navigateToTab(next)
      else if (activeNodeId) navigate(projectChatPath(activeNodeId))
      else navigate('/')
    }
  }

  const computeDropIndex = (clientX: number): number => {
    for (let i = 0; i < tabRefs.current.length; i++) {
      const el = tabRefs.current[i]
      if (!el) continue
      const { left, width } = el.getBoundingClientRect()
      if (clientX < left + width / 2) return i
    }
    return tabs.length
  }

  const handleTabDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(TAB_REORDER_TYPE, String(index))
    setDraggingIndex(index)
    setDropIndex(index)
    dropIndexRef.current = index
  }

  const handleBarDragOver = (e: React.DragEvent) => {
    const isReorder = e.dataTransfer.types.includes(TAB_REORDER_TYPE)
    const isExternal = e.dataTransfer.types.includes(CHAT_DRAG_TYPE)
    if (!isReorder && !isExternal) return
    e.preventDefault()
    if (isReorder) {
      const next = computeDropIndex(e.clientX)
      dropIndexRef.current = next
      setDropIndex(next)
    }
    if (isExternal) setDragOver(true)
  }

  const handleBarDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
    setDropIndex(null)
    dropIndexRef.current = null
  }

  const handleBarDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const fromStr = e.dataTransfer.getData(TAB_REORDER_TYPE)
    if (fromStr !== '') {
      const from = parseInt(fromStr, 10)
      const to = dropIndexRef.current ?? computeDropIndex(e.clientX)
      const adjusted = to > from ? to - 1 : to
      resetDragState()
      if (adjusted !== from) reorderChatTabs(from, adjusted)
      return
    }

    const raw = e.dataTransfer.getData(CHAT_DRAG_TYPE)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as {
        type: string; chatId: string; projectId: string
        workspaceId?: string; surfaceKey?: string; title?: string
      }
      if (data.type !== 'chat' || !data.chatId || !data.projectId) return
      openChatTab({
        chatId: data.chatId, projectId: data.projectId,
        workspaceId: data.workspaceId, surfaceKey: data.surfaceKey,
        title: data.title ?? null,
      })
      navigate(projectChatPath(data.projectId, {
        chatId: data.chatId, workspaceId: data.workspaceId, surfaceKey: data.surfaceKey,
      }))
    } catch { /* ignore */ }
  }

  // New chat: spin up a fresh (empty) thread in the current project so the pane opens in its
  // centered landing layout. We need the workspace context (carried by the active tab) — without it
  // the URL has no ?workspaceId= and useChat's redirect-to-main effect bails, leaving the pane stuck
  // in the bottom-pinned empty state. No project context → fall back to the home composer.
  const handleNewChat = async () => {
    const activeTab = tabs.find((tt) => tt.chatId === activeChatId)
    const workspaceId = activeTab?.workspaceId
    if (!activeNodeId || !workspaceId) {
      navigate('/')
      return
    }
    try {
      const { chatId } = await createChat({
        projectId: activeNodeId,
        workspaceId,
        kind: 'branch',
        title: 'New Chat',
      })
      // Pre-seed an empty transcript so the pane renders landing immediately (no loading flash).
      useChatStore.getState().setMessages(chatId, [])
      navigate(
        projectChatPath(activeNodeId, {
          chatId,
          workspaceId,
          surfaceKey: activeTab?.surfaceKey ?? ownerSurfaceKey(activeNodeId, workspaceId),
        }),
      )
    } catch {
      navigate('/')
    }
  }

  const isDragging = draggingIndex !== null

  return (
    <div
      className={`flex min-w-0 flex-1 items-center overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-colors ${
        dragOver ? 'bg-foreground/5' : ''
      }`}
      onDragOver={handleBarDragOver}
      onDragLeave={handleBarDragLeave}
      onDrop={handleBarDrop}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.chatId === activeChatId
        const isBeingDragged = isDragging && draggingIndex === index
        const isHovered = hoveredIndex === index && !isDragging
        const gapOpen = isDragging && dropIndex === index && draggingIndex !== index

        return (
          <div key={tab.chatId} className="contents">
            <div
              aria-hidden="true"
              className="shrink-0 self-center rounded transition-[width,opacity] duration-150 ease-out"
              style={{
                width: gapOpen ? 52 : 0,
                height: 22,
                opacity: gapOpen ? 1 : 0,
                background: 'color-mix(in srgb, currentColor 6%, transparent)',
              }}
            />

            <div
              ref={(el) => { tabRefs.current[index] = el }}
              draggable
              onDragStart={(e) => handleTabDragStart(e, index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex((h) => h === index ? null : h)}
              className={`relative mr-1 flex shrink-0 items-center select-none transition-opacity duration-150 ${
                isBeingDragged ? 'opacity-25' : 'opacity-100'
              }`}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                // Inactive tabs: force --button-bg-hover to transparent via inline style
                // so the CSS :hover background (var(--default)) never shows, even when
                // the browser keeps :hover stuck after a drag-drop ends.
                // Inline style wins over @heroui/styles class declarations.
                style={isActive ? undefined : { '--button-bg-hover': 'transparent' } as React.CSSProperties}
                className={`h-7 rounded pl-2.5 pr-6 text-xs font-normal transition-opacity ${
                  isActive ? 'text-foreground' : isHovered ? 'opacity-100' : 'opacity-40'
                }`}
                onPress={() => navigateToTab(tab)}
              >
                <span className="max-w-[7rem] truncate">{tab.title ?? 'Untitled'}</span>
              </Button>

              {/* Close button — visibility driven by JS hover state, not group-hover,
                  so it correctly hides when hoveredIndex is cleared on drag end. */}
              <Button
                isIconOnly variant="ghost" size="sm"
                className={`absolute right-0.5 !size-5 min-w-0 rounded transition-opacity ${
                  isActive
                    ? 'opacity-50 hover:opacity-100'
                    : isHovered ? 'opacity-60 hover:opacity-100' : 'opacity-0'
                }`}
                aria-label="Close tab"
                onPress={() => handleClose(tab.chatId)}
              >
                <X className="size-3" />
              </Button>
            </div>
          </div>
        )
      })}

      <div
        aria-hidden="true"
        className="shrink-0 self-center rounded transition-[width,opacity] duration-150 ease-out"
        style={{
          width: isDragging && dropIndex === tabs.length && draggingIndex !== tabs.length - 1 ? 52 : 0,
          height: 22,
          opacity: isDragging && dropIndex === tabs.length && draggingIndex !== tabs.length - 1 ? 1 : 0,
          background: 'color-mix(in srgb, currentColor 6%, transparent)',
        }}
      />

      <Button
        isIconOnly variant="ghost" size="sm"
        className="shrink-0 rounded !size-7 opacity-40 hover:opacity-100 transition-opacity"
        aria-label="New chat"
        onPress={() => void handleNewChat()}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}
