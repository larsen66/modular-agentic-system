import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useShellStrings } from '../../i18n'
import { WorkspaceBranch } from './WorkspaceBranch'
import { ExplorerEmptyState } from './ExplorerEmptyState'
import { TreeSkeleton } from './TreeSkeleton'

// The node tree (Nodes view): the active org's workspaces, each lazily expanding into its projects
// and chats. Scoped to the active org passed from the screen.
export function NodeTree({ orgId }: { orgId: string | null }) {
  const t = useShellStrings()
  const wsQuery = useWorkspaces(orgId ? [orgId] : [])
  const workspaces = wsQuery.data ?? []

  if (wsQuery.isLoading) return <TreeSkeleton rows={4} />
  if (wsQuery.isError)
    return (
      <ExplorerEmptyState
        message={t.explorer.empty.error}
        onRetry={() => void wsQuery.refetch()}
        retryLabel={t.explorer.retry}
      />
    )
  if (workspaces.length === 0) return <ExplorerEmptyState message={t.explorer.empty.workspaces} />

  return (
    <div className="flex flex-col gap-0.5">
      {workspaces.map((ws) => (
        <WorkspaceBranch key={ws.id} workspace={ws} />
      ))}
    </div>
  )
}
