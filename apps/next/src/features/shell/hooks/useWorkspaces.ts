import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrganization,
  createWorkspace,
  fetchWorkspacesForOrgs,
  type Workspace,
} from '@/core/workspaces'

const WORKSPACES_KEY = ['shell', 'workspaces'] as const
const ORGS_KEY = ['shell', 'orgs'] as const

// Workspaces for the user's orgs (server state via the core/workspaces seam, cached by react-query).
// Disabled until we have org ids so the hook can be called unconditionally.
export function useWorkspaces(orgIds: string[]) {
  return useQuery<Workspace[]>({
    queryKey: [...WORKSPACES_KEY, [...orgIds].sort().join(',')],
    queryFn: () => fetchWorkspacesForOrgs(orgIds),
    enabled: orgIds.length > 0,
    staleTime: 60_000,
  })
}

/** Create a workspace in an org (admin); invalidates the workspaces cache on success. */
export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { orgId: string; name: string }) => createWorkspace(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKSPACES_KEY }),
  })
}

/** Create an org + seed workspace (admin); invalidates orgs and workspaces on success. */
export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string }) => createOrganization(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      qc.invalidateQueries({ queryKey: WORKSPACES_KEY })
    },
  })
}

export type { Workspace }
