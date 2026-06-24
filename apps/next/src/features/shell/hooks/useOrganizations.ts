import { useQuery } from '@tanstack/react-query'
import { fetchOrganizations, type Organization } from '@/core/orgs'

// Organizations the user belongs to (server state via the core/orgs seam, cached by react-query).
// Disabled until we have a userId so the hook can be called unconditionally.
export function useOrganizations(userId: string | null | undefined) {
  return useQuery<Organization[]>({
    queryKey: ['shell', 'orgs', userId ?? null],
    queryFn: () => fetchOrganizations(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
}

export type { Organization }
