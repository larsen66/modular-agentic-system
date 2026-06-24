import { Button, Dropdown, Input, Label, Separator, Tooltip } from '@heroui/react'
import { ArrowUpRight, Check, Monitor, MoreVertical, RotateCw, Share2, Smartphone, Tablet } from 'lucide-react'
import { useCanvasStrings } from '../../i18n'
import type { PreviewToolbarProps, Viewport } from '../../types'

// The preview chrome toolbar — second row. Design reference: a browser-chrome strip (nav · address ·
// actions). We carry OUR controls into that look: reload (no back/forward — that's the host tool's,
// not ours), a read-only address field with an open-external affordance, and a `⋮` menu holding the
// viewport device-frame + Share & Publish. HeroUI components + semantic tokens only.

const VIEWPORT_ICON: Record<Viewport, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
}

export function PreviewToolbar({
  url,
  onReload,
  onOpenExternal,
  onShare,
  viewport,
  onViewportChange,
  disabled = false,
}: PreviewToolbarProps) {
  const t = useCanvasStrings()
  const viewports: Viewport[] = ['desktop', 'tablet', 'mobile']

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-overlay px-2">
      {/* Reload */}
      <Tooltip delay={300}>
        <Button isIconOnly size="sm" variant="ghost" aria-label={t.toolbar.reload} onPress={onReload} isDisabled={disabled}>
          <RotateCw className="size-4" />
        </Button>
        <Tooltip.Content placement="bottom">{t.toolbar.reload}</Tooltip.Content>
      </Tooltip>

      {/* Address (read-only) + open external */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Input
          readOnly
          tabIndex={-1}
          aria-label={t.toolbar.address}
          placeholder={t.toolbar.addressPlaceholder}
          value={url ?? ''}
          className="min-w-0 flex-1 !py-1 focus:!ring-0 focus:!outline-none"
        />
        <Tooltip delay={300}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t.toolbar.openExternal}
            onPress={onOpenExternal}
            isDisabled={disabled || !url}
          >
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Tooltip.Content placement="bottom">{t.toolbar.openExternal}</Tooltip.Content>
        </Tooltip>
      </div>

      {/* More actions — viewport + share */}
      <Dropdown>
        <Button isIconOnly size="sm" variant="ghost" aria-label={t.toolbar.actions}>
          <MoreVertical className="size-4" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              const k = String(key)
              if (k.startsWith('vp:')) onViewportChange(k.slice(3) as Viewport)
              else if (k === 'share') onShare?.()
              else if (k === 'external') onOpenExternal()
            }}
          >
            {viewports.map((vp) => {
              const Icon = VIEWPORT_ICON[vp]
              return (
                <Dropdown.Item key={vp} id={`vp:${vp}`} textValue={t.toolbar.viewport[vp]}>
                  <Icon className="size-4" />
                  <Label>{t.toolbar.viewport[vp]}</Label>
                  {viewport === vp ? <Check className="size-4" /> : null}
                </Dropdown.Item>
              )
            })}
            <Separator />
            <Dropdown.Item id="share" textValue={t.toolbar.share}>
              <Share2 className="size-4" />
              <Label>{t.toolbar.share}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  )
}
