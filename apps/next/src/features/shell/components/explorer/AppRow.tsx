import { Box, Folder } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import type { ProjectNode } from '../../types'
import { NodeRow } from './NodeRow'

// An app/folder item — a project node. Built on the base `NodeRow`; owns the app action set per the
// legacy map (legacy/explorer.md §5.1): a "+ New chat" create button and a rename/share/remove "⋯"
// menu. Folders render a folder icon. Selection + expand wiring stays in ProjectBranch.
export function AppRow({
  project,
  selected,
  expanded,
  onPress,
  onCreateChat,
  onMenuAction,
}: {
  project: ProjectNode
  selected: boolean
  expanded: boolean
  onPress: () => void
  onCreateChat: () => void
  onMenuAction: (id: string) => void
}) {
  const t = useShellStrings()
  const Icon = project.entityType === 'folder' ? Folder : Box
  return (
    <NodeRow
      depth={1}
      icon={<Icon className="size-4 text-muted" />}
      label={project.name}
      selected={selected}
      expanded={expanded}
      onPress={onPress}
      createLabel={t.explorer.actions.newChat}
      onCreate={onCreateChat}
      menuItems={[
        { id: 'rename', label: t.explorer.actions.rename },
        { id: 'share', label: t.explorer.actions.share },
        { id: 'remove', label: t.explorer.actions.remove, danger: true },
      ]}
      onMenuAction={onMenuAction}
    />
  )
}
