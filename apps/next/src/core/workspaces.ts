import { supabase } from './supabase'

// The creation RPCs may be absent from the generated types in some environments (legacy needed a
// cast for `create_workspace_in_organization`). A narrow rpc shim keeps the call typed at the
// boundary without forking on generated-type drift.
type RpcResult = { data: unknown; error: { message?: string } | null }
const rpc = (fn: string, args: Record<string, string>): Promise<RpcResult> =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, string>) => Promise<RpcResult>)(
    fn,
    args,
  )

// Workspace access (membership-first RLS path, documented in core/README.md). Workspaces are read
// from the `v_nodes` view (kind='workspace') and scoped to the orgs the caller belongs to; a DIRECT
// select on `workspaces` returns empty under RLS. Creation goes through fail-closed RPCs — NEVER a
// direct table insert (the server enforces org-membership + quota authz; a direct insert bypasses
// it). Framework-agnostic; the React hooks (features/shell/hooks/useWorkspaces) wrap these.

export interface Workspace {
  id: string
  name: string
  slug: string | null
  organizationId: string | null
}

/**
 * Resolve the workspaces belonging to the given orgs, scoped by RLS.
 * Mirrors the proven Explorer data path: `v_nodes(kind='workspace')` filtered to `orgIds`.
 */
export async function fetchWorkspacesForOrgs(orgIds: string[]): Promise<Workspace[]> {
  if (orgIds.length === 0) return []

  const { data, error } = await supabase
    .from('v_nodes')
    .select('source_id, name, slug, organization_id')
    .eq('kind', 'workspace')
    .in('organization_id', orgIds)
  if (error) throw new Error(`fetchWorkspacesForOrgs failed: ${error.message}`)

  return (data ?? []).map((node) => ({
    id: node.source_id as string,
    name: node.name as string,
    slug: (node.slug as string) ?? null,
    organizationId: (node.organization_id as string) ?? null,
  }))
}

/**
 * Create a workspace inside an org via the fail-closed RPC. Returns the new workspace id + name.
 * Throws on any RPC error (incl. missing RPC) — there is no direct-insert fallback by design.
 */
export async function createWorkspace(params: {
  orgId: string
  name: string
}): Promise<{ workspaceId: string; workspaceName: string }> {
  const name = params.name.trim()
  if (!name) throw new Error('Workspace name is required')

  const { data, error } = await rpc('create_workspace_in_organization', {
    p_org_id: params.orgId,
    p_workspace_name: name,
  })
  if (error) throw new Error(`createWorkspace failed: ${error.message ?? 'unknown error'}`)

  const row = (data ?? null) as { workspace_id?: string; workspace_name?: string } | null
  if (!row?.workspace_id) throw new Error('Workspace was created without an id')
  return { workspaceId: row.workspace_id, workspaceName: row.workspace_name ?? name }
}

/**
 * Create an organization (with an initial "Main" workspace) via the fail-closed RPC.
 * Returns the new org id and the seeded workspace id so the caller can switch scope directly
 * (the fresh workspace may not yet appear in a refetched list — legacy BW157).
 */
export async function createOrganization(params: {
  name: string
}): Promise<{ organizationId: string; workspaceId: string | null }> {
  const name = params.name.trim()
  if (!name) throw new Error('Organization name is required')

  const { data, error } = await rpc('create_organization_with_workspace', {
    p_org_name: name,
    p_workspace_name: 'Main',
  })
  if (error) throw new Error(`createOrganization failed: ${error.message ?? 'unknown error'}`)

  const row = (data ?? null) as { organization_id?: string; workspace_id?: string } | null
  if (!row?.organization_id) throw new Error('Organization was created without an id')
  return { organizationId: row.organization_id, workspaceId: row.workspace_id ?? null }
}
