import { useState } from 'react'
import { Button } from '@heroui/react'
import { ChevronRight, Plus } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import type { NodeRowProps } from '../../types'
import { NodeMenu } from './NodeMenu'
import { EXPLORER_ICON_BUTTON_CLASS } from './iconButton'


// The BASE Explorer item row — every item type (WorkspaceRow / AppRow / ChatRow) is a thin wrapper
// over this. A HeroUI Button item (leading chevron showing open state for branches, then the node
// icon + label) with the trailing "+"/"⋯" controls overlaid on the right. Item types differ only in
// icon + which action buttons they pass; all the row mechanics (hover, controls, fade) live here.
//
// "Item stays hovered" is the one bit of real logic: the row's hover is tracked in JS, because a
// HeroUI Button only keeps its background while the button element itself is hovered (no GridList
// row concept). `pointerleave` does NOT fire when moving between the label and the controls, so the
// row stays highlighted while you hover/click them — and while the "⋯" menu is open.
export function NodeRow({
  icon,
  label,
  labelSuffix,
  selected = false,
  ancestorActive = false,
  suppressDot = false,
  depth = 0,
  expanded,
  onPress,
  onCreate,
  createLabel,
  menuItems,
  onMenuAction,
  'aria-label': ariaLabel,
}: NodeRowProps) {
  const t = useShellStrings()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isBranch = expanded !== undefined
  const hasMenu = Boolean(menuItems && menuItems.length)
  const hasActions = Boolean(onCreate) || hasMenu
  const active = hovered || menuOpen

  // Depth class on the wrapper — overrides --default-hover for non-workspace rows so HeroUI's
  // ghost button hover naturally uses the lighter value (30% of original). The var cascades to
  // the overlay gradient too since it's a sibling inside the same wrapper.
  const depthClass = depth === 0 ? 'xr-depth-ws' : 'xr-depth-child'
  // Persistent bg class on the button.
  // Must cover three cases: ancestor-active workspace, selected item, AND JS-level hover (active).
  // The last case is necessary because when the pointer moves from the main Button to the action
  // buttons, HeroUI's internal data-hovered on the Button goes false and its ghost bg drops —
  // even though our wrapper-level hovered is still true. Applying the persist class whenever
  // active keeps the bg on for the whole row area.
  const persistClass =
    depth === 0 && (active || ancestorActive) ? 'xr-persist-ws'
    : (selected || active) ? 'xr-persist-child'
    : ''

  return (
    <div
      className={`relative flex w-full items-center ${depthClass}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Button
        variant="ghost"
        size="sm"
        className={`min-w-0 flex-1 rounded-xxl font-light justify-start gap-1.5 ${persistClass}`}
        style={{ paddingLeft: (depth + 1) * 12 }}
        onPress={onPress}
        aria-label={ariaLabel ?? label}
        aria-expanded={isBranch ? Boolean(expanded) : undefined}
      >
        {isBranch ? (
          <ChevronRight
            className={`size-3.5 shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        ) : (
          // Same size as the chevron so leaf labels align with branch labels.
          // xr-chat-dot-ref: anchor for the ProjectBranch flying dot to measure.
          // suppressDot: parent owns an animated flying dot — hide the static one.
          <span className="xr-chat-dot-ref size-3.5 shrink-0 flex items-center justify-center" aria-hidden>
            {selected && !suppressDot ? <span className="size-1.5 rounded-full bg-accent" /> : null}
          </span>
        )}
        <span className="flex shrink-0 items-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {labelSuffix ? <span className="shrink-0 text-muted">{labelSuffix}</span> : null}
      </Button>
      {hasActions && active ? (
        <>
          {/* Fade using var(--default-hover) — already overridden per depth on the wrapper,
              so workspace gets the full token and child rows get the 40% version. No custom
              colour values; everything is a HeroUI token. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-24 rounded-r-[8px]"
            style={{ background: `linear-gradient(to left, var(--default-hover) 60%, transparent)` }}
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            {onCreate ? (
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                className={EXPLORER_ICON_BUTTON_CLASS}
                aria-label={createLabel ?? t.explorer.actions.menu}
                onPress={onCreate}
              >
                <Plus className="size-3 text-muted" />
              </Button>
            ) : null}
            {hasMenu ? (
              <NodeMenu
                label={label}
                items={menuItems ?? []}
                onAction={(id) => onMenuAction?.(id)}
                isOpen={menuOpen}
                onOpenChange={setMenuOpen}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
