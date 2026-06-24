import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@heroui/react'
import { useShellStrings } from '@/features/shell/i18n'
import { getScreen } from './screenRegistry'

interface PaneProps {
  /**
   * The screen id to render. Must be registered in the screen registry via registerScreen().
   * The Pane is content-agnostic: it does not know what the hosted screen is.
   */
  screenId: string
  /**
   * True while this pane is being dragged — passed by Stage. The pane dims slightly to
   * signal it is the dragged item; no transform is applied (the dock-snap model snaps on
   * release, not free-drag).
   */
  isDragging?: boolean
  /**
   * Host-driven status colour forwarded to the HeroUI Badge on the header status dot.
   * Defaults to undefined (no dot shown).
   */
  statusColor?: 'success' | 'warning' | 'danger' | 'default'
}

/**
 * Pane — dumb content host.
 *
 * Renders a slim header (screen title + drag handle + optional status dot) above the body
 * that renders the registered screen. The header is the drag handle via useDraggable (dnd-kit).
 *
 * Design contract (stage.md §3, content-dock-snap.md §3):
 *  - The hosted screen receives no pane context (content-agnostic host).
 *  - HeroUI Badge for the status dot; no other HeroUI in the frame.
 *  - No close / split / minimize / maximize / float controls (explicit non-goals).
 */
export function Pane({ screenId, isDragging = false, statusColor }: PaneProps) {
  const t = useShellStrings()

  // Drag handle — the useDraggable id matches the screenId so Stage can correlate.
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: screenId })

  const Screen = getScreen(screenId)

  // Resolve display title. If the screen is not registered we render a fallback.
  const title = t.stage.pane[screenId as keyof typeof t.stage.pane] ?? screenId

  // No transform applied to the outer container — the dock-snap model snaps on release,
  // not free-drag. Opacity feedback is sufficient to signal the dragged pane.
  // (transform is consumed only to prevent stale import warnings; it is not applied.)
  void transform

  return (
    <div
      className={`flex h-full flex-col overflow-hidden transition-opacity ${isDragging ? 'opacity-60' : 'opacity-100'}`}
      data-pane-id={screenId}
    >
      {/* Header — drag handle + title + optional status badge. */}
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex h-8 shrink-0 cursor-grab select-none items-center gap-2 border-b bg-content1 px-3 active:cursor-grabbing"
        aria-label={t.stage.pane.dragHandle}
      >
        {/* Status dot — HeroUI Badge, only shown when statusColor is provided. */}
        {statusColor !== undefined ? (
          <Badge
            content=""
            color={statusColor}
            size="sm"
            placement="top-right"
            className="translate-x-0 translate-y-0"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
          </Badge>
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-default-300" aria-hidden="true" />
        )}

        <span className="flex-1 truncate text-xs font-medium text-default-600">{title}</span>
      </div>

      {/* Body — renders the registered screen, or a slim error state if missing. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {Screen ? (
          <Screen />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-default-400">{t.stage.pane.notRegistered}</span>
          </div>
        )}
      </div>
    </div>
  )
}
