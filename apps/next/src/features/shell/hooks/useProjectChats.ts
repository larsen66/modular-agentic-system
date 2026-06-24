import { useQuery } from '@tanstack/react-query'
import { fetchProjectChats, type ChatNode } from '@/core/explorer'

// Chats under a project (server state via the core/explorer seam). Lazy: `enabled` is true only
// once the project branch is expanded (tree) or the project is the active one (Chats tab). The
// optional `workspaceId` scopes a chat list to its host workspace (cross-workspace scoping, BC205).
export function useProjectChats(
  projectId: string | null | undefined,
  workspaceId?: string | null,
  enabled = true,
) {
  return useQuery<ChatNode[]>({
    queryKey: ['shell', 'projectChats', projectId ?? null, workspaceId ?? null],
    queryFn: () => fetchProjectChats(projectId as string, workspaceId ?? undefined),
    enabled: Boolean(projectId) && enabled,
    staleTime: 15_000,
  })
}

export type { ChatNode }
