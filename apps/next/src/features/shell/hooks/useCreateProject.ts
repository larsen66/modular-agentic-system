import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProject } from '@/core/projects'

// Mutation hook for creating a new app (project node) inside a workspace. On success, invalidates
// the projects query for the workspace so the new app appears in the tree.
export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createProject({ workspaceId, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shell', 'projects', workspaceId] })
    },
  })
}
