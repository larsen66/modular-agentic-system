import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/state/uiStore'
import { ownerSurfaceKey, projectChatPath } from '@/lib/route'
import { useProjects } from '../../hooks/useProjects'
import { useShellStrings } from '../../i18n'
import { useProjectStatuses } from '../../hooks/useProjectStatuses'
import { useRenameWorkspace } from '../../hooks/useExplorerMutations'
import { useCreateProject } from '../../hooks/useCreateProject'
import type { Workspace } from '../../types'
import { WorkspaceRow } from './WorkspaceRow'
import { ProjectBranch } from './ProjectBranch'
import { ExplorerEmptyState } from './ExplorerEmptyState'
import { TreeSkeleton } from './TreeSkeleton'
import { RenameModal } from './RenameModal'
import { CreateAppModal } from './CreateAppModal'

// A workspace branch: expanded by default (sensible default vs the legacy depth cycler). Its
// chevron lazily loads + reveals the workspace's projects. Workspaces aren't "opened" into the
// Stage in v1 — the row just toggles.
export function WorkspaceBranch({ workspace }: { workspace: Workspace }) {
  const t = useShellStrings()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const [renameOpen, setRenameOpen] = useState(false)
  const [createAppOpen, setCreateAppOpen] = useState(false)

  const activeNodeId = useUiStore((s) => s.activeNodeId)
  const projectsQuery = useProjects(workspace.id, expanded)
  const projects = projectsQuery.data ?? []
  const toggle = () => setExpanded((v) => !v)

  // Light up the workspace row when any of its projects is the active node.
  const isAncestorActive = projects.some((p) => p.id === activeNodeId)

  // Status polling for project health dots
  const statusesQuery = useProjectStatuses(workspace.id)
  const statuses = statusesQuery.data ?? []

  // Mutations
  const renameWs = useRenameWorkspace([])
  const createProject = useCreateProject(workspace.id)

  return (
    <>
      <div className="flex flex-col gap-0.5 p-0">
        <WorkspaceRow
          name={workspace.name}
          expanded={expanded}
          ancestorActive={isAncestorActive}
          onToggle={toggle}
          onCreateApp={() => setCreateAppOpen(true)}
          onMenuAction={(id) => {
            if (id === 'rename') setRenameOpen(true)
            // 'remove' → workspaces are managed by the org admin; silently ignore.
          }}
        />
        {/* Children render as direct siblings of the row (a Fragment, not a nested gap wrapper) so the
            ONE `gap-0.5` on this container spaces the row and every child identically. */}
        {expanded ? (
          <>
            {projectsQuery.isLoading ? <TreeSkeleton rows={2} indent={1} /> : null}
            {projectsQuery.isError ? (
              <ExplorerEmptyState
                message={t.explorer.empty.error}
                onRetry={() => void projectsQuery.refetch()}
                retryLabel={t.explorer.retry}
              />
            ) : null}
            {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 ? (
              <p className="py-1 text-sm text-muted" style={{ paddingLeft: 1 * 12 + 12 }}>
                {t.explorer.empty.projects}
              </p>
            ) : null}
            {projects.map((p) => {
              const projectStatus = statuses.find((s) => s.projectId === p.id) ?? null
              return (
                <ProjectBranch
                  key={p.id}
                  project={p}
                  workspaceId={workspace.id}
                  projectStatus={projectStatus}
                />
              )
            })}
          </>
        ) : null}
      </div>

      <RenameModal
        isOpen={renameOpen}
        currentName={workspace.name}
        entityLabel="workspace"
        onClose={() => setRenameOpen(false)}
        onSave={(name) => renameWs.mutateAsync({ id: workspace.id, name })}
      />

      <CreateAppModal
        isOpen={createAppOpen}
        onClose={() => setCreateAppOpen(false)}
        onCreate={async (name) => {
          const { projectId } = await createProject.mutateAsync(name)
          // Navigate to the new project (no chatId yet — controller resolves main chat).
          const surfaceKey = ownerSurfaceKey(projectId, workspace.id)
          navigate(projectChatPath(projectId, { workspaceId: workspace.id, surfaceKey }))
        }}
      />
    </>
  )
}
