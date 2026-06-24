import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createChat } from '@/core/projects'

// Mutation hook for creating a new chat thread under a project. On success, invalidates the
// projectChats query so the new chat appears in the tree.
export function useCreateChat(projectId: string, workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) =>
      createChat({
        projectId,
        workspaceId,
        title: title ?? 'New Chat',
        kind: 'branch',
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['shell', 'projectChats', projectId, workspaceId],
      })
    },
  })
}
