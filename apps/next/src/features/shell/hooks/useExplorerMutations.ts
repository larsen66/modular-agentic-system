import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  renameWorkspace,
  renameProject,
  deleteProject,
  renameChat,
  deleteChat,
} from '@/core/explorerMutations'

// Explorer write-side hooks — rename / delete for workspaces, projects, chats. Each hook
// invalidates the relevant react-query cache key so the tree refetches on success.
//
// Query key conventions (must match the read hooks):
//   workspaces: ['shell', 'workspaces', ...]  (useWorkspaces WORKSPACES_KEY)
//   projects:   ['shell', 'projects', workspaceId]  (useProjects)
//   chats:      ['shell', 'projectChats', projectId, workspaceId]  (useProjectChats)

export function useRenameWorkspace(_orgIds?: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameWorkspace(id, name),
    onSuccess: () => {
      // Invalidate the workspaces query (by prefix — the exact key includes the sorted orgIds string).
      qc.invalidateQueries({ queryKey: ['shell', 'workspaces'] })
    },
  })
}

export function useRenameProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameProject(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shell', 'projects', workspaceId] })
    },
  })
}

export function useDeleteProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shell', 'projects', workspaceId] })
    },
  })
}

export function useRenameChat(projectId: string, workspaceId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameChat(id, title),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['shell', 'projectChats', projectId, workspaceId ?? null],
      })
    },
  })
}

export function useDeleteChat(projectId: string, workspaceId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['shell', 'projectChats', projectId, workspaceId ?? null],
      })
    },
  })
}
