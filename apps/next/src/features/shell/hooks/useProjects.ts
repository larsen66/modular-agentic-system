import { useQuery } from '@tanstack/react-query'
import { fetchProjects, type ProjectNode } from '@/core/explorer'

// Projects (apps + folders) under a workspace (server state via the core/explorer seam). Lazy: the
// caller passes `enabled` (true only once the workspace branch is expanded) so the tree fetches a
// workspace's children on demand, never upfront for every workspace.
export function useProjects(workspaceId: string | null | undefined, enabled = true) {
  return useQuery<ProjectNode[]>({
    queryKey: ['shell', 'projects', workspaceId ?? null],
    queryFn: () => fetchProjects(workspaceId as string),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 30_000,
  })
}

export type { ProjectNode }
