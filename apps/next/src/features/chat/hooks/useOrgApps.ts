import { useQuery } from '@tanstack/react-query'
import { fetchAppsForOrg, type OrgAppOption } from '@/core/explorer'

// The org's apps (across all its workspaces), for the landing composer's app picker. Chat-local
// (no cross-feature import of shell's useProjects — ARCHITECTURE §3); resolves via the shared
// `@/core/explorer` seam. Disabled until an org is resolved.
export function useOrgApps(orgId: string | null | undefined) {
  return useQuery<OrgAppOption[]>({
    queryKey: ['chat', 'orgApps', orgId ?? null],
    queryFn: () => fetchAppsForOrg(orgId as string),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })
}
