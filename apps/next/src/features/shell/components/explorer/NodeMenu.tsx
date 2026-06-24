import { Dropdown, Label } from '@heroui/react'
import { MoreHorizontal } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import type { NodeMenuProps } from '../../types'
import { EXPLORER_ICON_BUTTON_CLASS } from './iconButton'

// The "⋯" edit menu for a tree row: a HeroUI Dropdown (controlled, so the row can stay highlighted
// while it's open). Minimal ghost trigger; destructive items use `variant="danger"`. Action ids
// route to the context-actions flow (docs/design/shell/flows/explorer-context-actions.md).
export function NodeMenu({ label, items, onAction, isOpen, onOpenChange }: NodeMenuProps) {
  const t = useShellStrings()
  return (
    <Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
      {/* `Dropdown.Trigger` renders its OWN <button> (unlike `Popover.Trigger`, which merges into a
          child Button) — so the icon goes directly inside it; wrapping a <Button> here would nest
          <button> in <button>. The icon-button styling + transform pin move onto the trigger itself. */}
      <Dropdown.Trigger
        className={`inline-flex! items-center! justify-center! text-muted ${EXPLORER_ICON_BUTTON_CLASS}`}
        aria-label={`${label} · ${t.explorer.actions.menu}`}
      >
        <MoreHorizontal className="size-3" />
      </Dropdown.Trigger>
      {/* HeroUI v3 has no `size` prop on Dropdown — the popover ships roomy by default (`md:min-w-55`,
          `text-sm`). For a short context menu we shrink it via className: a smaller width floor,
          smaller text, tighter menu padding + shorter rows. (Corner radius comes from the global
          `--radius` in index.css.) */}
      <Dropdown.Popover
        placement="bottom end"
        className="min-w-36! text-xs [&_[data-slot=dropdown-menu]]:p-1 [&_[data-slot=menu-item]]:py-1"
      >
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              variant={item.danger ? 'danger' : undefined}
            >
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
