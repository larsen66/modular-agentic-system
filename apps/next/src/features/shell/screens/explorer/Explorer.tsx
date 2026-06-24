import { ScrollShadow, Tabs } from '@heroui/react'
import { useUiStore, type ExplorerView } from '@/state/uiStore'
import { useActiveOrg } from '../../hooks/useActiveOrg'
import { deriveDisplayName } from '../../hooks/useCurrentUser'
import { useShellStrings } from '../../i18n'
import { NodeTree } from '../../components/explorer/NodeTree'
import { AllChatsList } from '../../components/explorer/AllChatsList'
import { ExplorerEmptyState } from '../../components/explorer/ExplorerEmptyState'
import { FilesPanel } from '../files'
import { PeoplePanel } from '../people'
import { HistoryPanel } from '../history'
import { SettingsNavTree } from '../settings'
import { MarketplacePanel } from '../marketplace'

// The Explorer screen: the docked panel that opens out of the Rail and shows the content for the
// active Rail mode. In `explorer` mode the Nodes / Chats tab switcher is the top section, hosting
// the node tree + the flat chat list; other modes (Files/People/History/Settings) are owned by
// their own areas and show an honest empty-state here for v1 (design:
// docs/design/shell/screens/explorer.md). Composition only — data lives in the building blocks
// over the core/* seam.
export function Explorer() {
  const t = useShellStrings()
  const activeMode = useUiStore((s) => s.activeMode)
  const explorerView = useUiStore((s) => s.explorerView)
  const setExplorerView = useUiStore((s) => s.setExplorerView)
  const { currentOrg, user } = useActiveOrg()

  // The Nodes tab reads as the user's home: "{first name}'s BOS"; falls back to the generic label
  // when there is no resolvable name.
  const displayName = deriveDisplayName(user)
  const nodesLabel = displayName
    ? t.explorer.tabs.nodesOwned.replace('{name}', displayName)
    : t.explorer.tabs.nodes

  if (activeMode !== 'explorer') {
    const modePanel: Record<string, React.ReactNode> = {
      files: <FilesPanel />,
      people: <PeoplePanel />,
      history: <HistoryPanel />,
      settings: <SettingsNavTree />,
      marketplace: <MarketplacePanel />,
    }
    const panel = modePanel[activeMode] ?? (
      <ExplorerEmptyState message={t.explorer.modeUnavailable} />
    )
    return (
      <section aria-label={t.explorer.title} className="flex h-full flex-col overflow-hidden p-2">
        {panel}
      </section>
    )
  }

  return (
    <section
      aria-label={t.explorer.title}
      // ONE padding for the whole panel — this `p-1` is the only inset that keeps the tab pills and
      // row backgrounds off the panel edge. HeroUI's nested `.tabs__list`/`.tabs__panel` paddings (and
      // the old chats `px-1`) are zeroed below, so nothing stacks; the tabs and rows then share the
      // same 12px content indent (tab `pl-[12px]`, row `paddingLeft`) and line up on one left edge.
      className="flex h-full flex-col overflow-hidden p-2"
    >
      <Tabs
        selectedKey={explorerView}
        onSelectionChange={(k) => setExplorerView(k as ExplorerView)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.ListContainer>
          {/* Holder un-rounded + un-padded (HeroUI's `.tabs__list` ships `p-1` + a bg); the tab items
              carry the shared 12px left inset so their text aligns with the tree rows, and `font-normal`
              drops HeroUI's `font-medium` (no weight). */}
          <Tabs.List aria-label={t.explorer.title} className="rounded-none bg-transparent p-0!">
            <Tabs.Tab id="nodes" className="rounded-xxl pl-[12px]! font-normal!">
              {nodesLabel}
              <Tabs.Indicator className="rounded-xxl" />
            </Tabs.Tab>
            <Tabs.Tab id="chats" className="rounded-xxl pl-[12px]! font-normal!">
              {t.explorer.tabs.chats}
              <Tabs.Indicator className="rounded-xxl" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        {/* `p-0!` zeroes HeroUI's `.tabs__panel` `p-2` so the rows' own 12px is the only inset (no
            nesting). The rows align with the tabs above. */}
        <Tabs.Panel id="nodes" className="min-h-0 flex-1 p-0!">
          <ScrollShadow className="h-full">
            <NodeTree orgId={currentOrg?.id ?? null} />
          </ScrollShadow>
        </Tabs.Panel>
        <Tabs.Panel id="chats" className="min-h-0 flex-1 p-0!">
          <ScrollShadow className="h-full">
            <AllChatsList />
          </ScrollShadow>
        </Tabs.Panel>
      </Tabs>
    </section>
  )
}
