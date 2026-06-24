import { supabase } from './supabase'

// Organization access (membership-first RLS path, proven in the connectivity test and documented
// in core/README.md). A DIRECT select on `organizations` returns empty under RLS — membership
// comes first: node_memberships → v_nodes(kind='org'). Framework-agnostic; the React hook
// (features/shell/hooks/useOrganizations) wraps this with react-query.

export interface Organization {
  id: string
  name: string
  slug: string | null
  /** The caller's role in this org (from node_memberships.role_key). */
  role: string | null
}

interface OrgMembershipRow {
  node_id: string
  role_key: string | null
}

interface OrgNodeRow {
  source_id: string
  name: string
  slug: string | null
}

/**
 * Resolve the organizations the signed-in user belongs to, scoped by RLS.
 * Two-step: the user's `direct_org` memberships, then the org node metadata for those ids.
 */
export interface OrgMember {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
  role: string | null
}

interface MemberRow {
  principal_id: string
  role_key: string | null
  principals: {
    email: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}

/**
 * Fetch all members of an organization by org node id.
 * node_memberships joins principals (not profiles) for display info.
 */
export async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('node_memberships')
    .select('principal_id, role_key, principals(email, display_name, avatar_url)')
    .eq('node_id', orgId)
    .eq('source_kind', 'direct_org')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`fetchOrgMembers failed: ${error.message}`)

  return ((data ?? []) as unknown as MemberRow[]).map((row) => ({
    id: row.principal_id,
    email: row.principals?.email ?? null,
    fullName: row.principals?.display_name ?? null,
    avatarUrl: row.principals?.avatar_url ?? null,
    role: row.role_key ?? null,
  }))
}

export async function fetchOrganizations(userId: string): Promise<Organization[]> {
  const { data: memberships, error: membErr } = await supabase
    .from('node_memberships')
    .select('node_id, role_key')
    .eq('principal_id', userId)
    .eq('source_kind', 'direct_org')
  if (membErr) throw new Error(`fetchOrganizations memberships failed: ${membErr.message}`)

  const orgMemberships = (memberships ?? []) as OrgMembershipRow[]
  const orgIds = orgMemberships.map((m) => m.node_id)
  if (orgIds.length === 0) return []

  const roleByOrg = new Map<string, string>()
  for (const m of orgMemberships) {
    if (m.role_key) roleByOrg.set(m.node_id, m.role_key)
  }

  const { data: orgNodes, error: nodeErr } = await supabase
    .from('v_nodes')
    .select('source_id, name, slug')
    .eq('kind', 'org')
    .in('source_id', orgIds)
  if (nodeErr) throw new Error(`fetchOrganizations org nodes failed: ${nodeErr.message}`)

  return ((orgNodes ?? []) as OrgNodeRow[]).map((node) => ({
    id: node.source_id,
    name: node.name,
    slug: node.slug ?? null,
    role: roleByOrg.get(node.source_id) ?? null,
  }))
}
