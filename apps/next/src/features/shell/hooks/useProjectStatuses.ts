import { useQuery } from '@tanstack/react-query'
import { fetchProjectStatuses, type ProjectStatus } from '@/core/status'

// Lightweight polling hook for project health indicators in the Explorer tree. Short staleTime so
// the dots update quickly (running/error states change in seconds); refetchInterval drives the poll.
// Disabled when no workspaceId is available.
export function useProjectStatuses(workspaceId: string | null | undefined) {
  return useQuery<ProjectStatus[]>({
    queryKey: ['project-statuses', workspaceId ?? null],
    queryFn: () => fetchProjectStatuses(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 5_000,
    refetchInterval: 10_000,
  })
}

export type { ProjectStatus }
