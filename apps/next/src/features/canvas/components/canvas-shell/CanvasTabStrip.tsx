import { Button, Dropdown, Label, Tooltip } from '@heroui/react'
import { File, GitCompare, Globe, History, Maximize2, Minimize2, Network, PanelRight, Plus, Puzzle, Store, X } from 'lucide-react'
import { useCanvasStrings } from '../../i18n'
import type { CanvasTab, CanvasTabStripProps } from '../../types'

// The canvas tab strip — top row of the pane. Ghost icon+label tab BUTTONS (not HeroUI Tabs
// component — owner directive). Inspired by ChatTabBar: inactive tabs at opacity-40 with
// hover-reveal close buttons. Difference from chat: active tabs use text-primary (accent).

function tabIcon(tab: CanvasTab) {
  switch (tab.kind) {
    case 'file':
      return <File className="size-3.5 shrink-0" />
    case 'diff':
      return <GitCompare className="size-3.5 shrink-0" />
    case 'graph':
      return <Network className="size-3.5 shrink-0" />
    case 'history':
      return <History className="size-3.5 shrink-0" />
    case 'child':
      return <Puzzle className="size-3.5 shrink-0" />
    case 'page':
      return <Store className="size-3.5 shrink-0" />
    default:
      return <Globe className="size-3.5 shrink-0" />
  }
}

export function CanvasTabStrip({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onOpenFile,
  onExpand,
  expanded,
  onClose,
  flush,
}: CanvasTabStripProps) {
  const t = useCanvasStrings()

  // Right controls: absolutely positioned so they're always pinned to the right edge of the
  // strip — taken out of flex flow so flex reflow during parent width changes never shifts them.
  const rightControlCount = onExpand ? 2 : 1
  const rightPad = rightControlCount === 2 ? 'pr-[56px]' : 'pr-[28px]'

  return (
    <div
      className={`relative flex h-10 shrink-0 items-center gap-1 bg-overlay pl-2 ${rightPad}${flush ? '' : ' border-b'}`}
    >
      {/* Tab buttons — chat-inspired: group wrapper, opacity fade for inactive, hover-reveal close */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId
          return (
            // `group` drives close-button hover-reveal on inactive tabs (same as ChatTabBar).
            <div key={tab.id} className="group relative flex shrink-0 items-center">
              <Button
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                className={`h-8 rounded font-normal transition-opacity ${
                  tab.closable ? 'pr-6' : ''
                } ${active ? 'text-primary' : 'opacity-40 hover:opacity-100'}`}
                onPress={() => onSelectTab(tab.id)}
              >
                {tabIcon(tab)}
                <span className="max-w-40 truncate">{tab.label}</span>
              </Button>

              {/* Close button: overlaid on right edge, revealed on hover (same as ChatTabBar) */}
              {tab.closable && onCloseTab ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className={`absolute right-0.5 !size-5 min-w-0 rounded transition-opacity ${
                    active
                      ? 'opacity-50 hover:opacity-100'
                      : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                  }`}
                  aria-label={t.tabs.close}
                  onPress={() => onCloseTab(tab.id)}
                >
                  <X className="size-3" />
                </Button>
              ) : null}
            </div>
          )
        })}

        {/* `+` open menu */}
        <Dropdown>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t.tabs.add} className="shrink-0 rounded opacity-40 hover:opacity-100 transition-opacity">
            <Plus className="size-4" />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'open-file') onOpenFile?.()
              }}
            >
              <Dropdown.Item id="open-file" textValue={t.tabs.openFile}>
                <File className="size-4" />
                <Label>{t.tabs.openFile}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      {/* Right controls — absolutely pinned to right edge so flex reflow never shifts them */}
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {onExpand ? (
          <Tooltip delay={300}>
            <Button isIconOnly size="sm" variant="ghost" aria-label={expanded ? t.tabs.collapse : t.tabs.expand} onPress={onExpand} className="rounded opacity-40 hover:opacity-100 transition-opacity">
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Tooltip.Content placement="bottom">{expanded ? t.tabs.collapse : t.tabs.expand}</Tooltip.Content>
          </Tooltip>
        ) : null}
        <Tooltip delay={300}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t.tabs.hidePanel} onPress={onClose} className="rounded opacity-40 hover:opacity-100 transition-opacity">
            <PanelRight className="size-4" />
          </Button>
          <Tooltip.Content placement="bottom">{t.tabs.hidePanel}</Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  )
}
