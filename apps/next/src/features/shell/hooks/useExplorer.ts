import { useQuery } from '@tanstack/react-query'
import { fetchTree, fetchChatsForApp } from '@/core/explorer'
import type { OrgNode, ChatNode } from '@/core/explorer'

// Explorer tree query. Keyed on ['explorer','tree',userId] so multiple callers share the cache.
// Disabled until userId is known. staleTime 60s — tree changes are infrequent.
export function useExplorer(userId: string | null | undefined) {
  return useQuery<OrgNode[]>({
    queryKey: ['explorer', 'tree', userId ?? null],
    queryFn: () => fetchTree(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
}

// Per-app chats query. Lazy: only called when the user expands an app node.
// Keyed on ['explorer','chats',appId] — React Query deduplicates concurrent calls for the same app.
export function useAppChats(appId: string | null | undefined) {
  return useQuery<ChatNode[]>({
    queryKey: ['explorer', 'chats', appId ?? null],
    queryFn: () => fetchChatsForApp(appId as string),
    enabled: Boolean(appId),
    staleTime: 30_000,
  })
}

export type { OrgNode, ChatNode }
