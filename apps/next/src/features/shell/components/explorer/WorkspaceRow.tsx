import { FolderOpen } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import { NodeRow } from './NodeRow'

// A workspace item — the org's container node. Built on the base `NodeRow`; owns the workspace's
// action set per the legacy map (legacy/explorer.md §5.1): a "+ New app" create button and a
// rename/remove "⋯" menu. Expand/data wiring stays in WorkspaceBranch; this is presentation only.
export function WorkspaceRow({
  name,
  expanded,
  ancestorActive,
  onToggle,
  onCreateApp,
  onMenuAction,
}: {
  name: string
  expanded: boolean
  ancestorActive?: boolean
  onToggle: () => void
  onCreateApp: () => void
  onMenuAction: (id: string) => void
}) {
  const t = useShellStrings()
  return (
    <NodeRow
      depth={0}
      icon={<FolderOpen className="size-4 text-muted" />}
      label={name}
      expanded={expanded}
      ancestorActive={ancestorActive}
      onPress={onToggle}
      createLabel={t.explorer.actions.newApp}
      onCreate={onCreateApp}
      menuItems={[
        { id: 'rename', label: t.explorer.actions.rename },
        { id: 'remove', label: t.explorer.actions.remove, danger: true },
      ]}
      onMenuAction={onMenuAction}
    />
  )
}
