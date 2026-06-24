import { useMemo } from 'react'
import { useUiStore } from '@/state/uiStore'
import type { Organization } from '@/core/orgs'
import { useCurrentUser } from './useCurrentUser'
import { useOrganizations } from './useOrganizations'

// The active organization, shared by the Rail (org switcher) and the Explorer (tree scope). The
// user's explicit pick lives in the cross-cutting uiStore (`activeOrgId`); until they choose, we
// fall back to the first org. Centralizing this here keeps the Rail and Explorer on ONE scope.
export function useActiveOrg() {
  const { user, loading: sessionLoading } = useCurrentUser()
  const orgsQuery = useOrganizations(user?.id)
  const orgs = useMemo<Organization[]>(() => orgsQuery.data ?? [], [orgsQuery.data])
  const activeOrgId = useUiStore((s) => s.activeOrgId)
  const currentOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null
  return { user, orgs, currentOrg, sessionLoading, orgsLoading: orgsQuery.isLoading }
}
