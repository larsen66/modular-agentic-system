import { supabase } from './supabase'
import { fetchWorkspacesForOrgs } from './workspaces'

// Explorer node-graph access (membership-first RLS path, documented in core/README.md and mined in
// docs/design/shell/legacy/explorer.md §4). The proven cascade is
//   node_memberships → v_nodes(kind=org/workspace/app|folder) → node_links(mount) → project_chats
// Orgs + workspaces have their own seams (core/orgs, core/workspaces); this module owns the lower
// two levels: a workspace's projects (apps/folders) and a project's chats. Framework-agnostic; the
// React hooks (features/shell/hooks/useProjects, useProjectChats) wrap these with react-query and
// lazy-load them on expand. A DIRECT select on the underlying tables returns empty under RLS.

/** A project node under a workspace: an app or a folder. */
export interface ProjectNode {
  id: string
  name: string
  /** Lucide-ish icon key from the node metadata, or null (caller picks a default). */
  icon: string | null
  entityType: 'app' | 'folder'
  updatedAt: string | null
}

/** A chat (thread) under a project. */
export interface ChatNode {
  id: string
  name: string
  kind: 'main' | 'branch' | 'scratch' | 'task-run' | string
  status: 'active' | 'paused' | 'archived' | string
  /** Best activity timestamp: last_activity_at ?? last_message_at ?? created_at. */
  activityAt: string | null
  workspaceId: string | null
}

/**
 * Resolve the projects (apps + folders) directly owned by a workspace, RLS-scoped.
 * Mirrors the proven path: `v_nodes(kind in ['app','folder'], workspace_id = wsId)`, newest first.
 * (Mounted apps — `node_links(link_kind='mount')` — are a deferred v1 capability; see the screen
 * spec §5 #18-19. This returns owned nodes only for now.)
 */
export async function fetchProjects(workspaceId: string): Promise<ProjectNode[]> {
  const { data, error } = await supabase
    .from('v_nodes')
    .select('source_id, name, icon, kind, updated_at')
    .eq('workspace_id', workspaceId)
    .in('kind', ['app', 'folder'])
    .order('updated_at', { ascending: false })
  if (error) throw new Error(`fetchProjects failed: ${error.message}`)

  return (data ?? []).map((node) => ({
    id: node.source_id as string,
    name: (node.name as string) ?? 'Untitled',
    icon: (node.icon as string) ?? null,
    entityType: (node.kind as string) === 'folder' ? 'folder' : 'app',
    updatedAt: (node.updated_at as string) ?? null,
  }))
}

/**
 * Resolve a project's chats, RLS-scoped, newest activity first. Archived rows are filtered
 * CLIENT-SIDE (legacy parity — the query has no server-side status filter). Optionally scoped to a
 * host workspace (cross-workspace chat scoping, BC205) when the same app is mounted in several.
 */
export async function fetchProjectChats(
  projectId: string,
  workspaceId?: string | null,
): Promise<ChatNode[]> {
  let query = supabase
    .from('project_chats')
    .select(
      'id, project_id, workspace_id, title, kind, status, last_activity_at, last_message_at, created_at',
    )
    .eq('project_id', projectId)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data, error } = await query.order('last_activity_at', { ascending: false })
  if (error) throw new Error(`fetchProjectChats failed: ${error.message}`)

  return (data ?? [])
    .filter((row) => (row.status as string) !== 'archived')
    .map((row) => ({
      id: row.id as string,
      name: (row.title as string) || 'Untitled chat',
      kind: (row.kind as string) ?? 'main',
      status: (row.status as string) ?? 'active',
      activityAt:
        (row.last_activity_at as string) ??
        (row.last_message_at as string) ??
        (row.created_at as string) ??
        null,
      workspaceId: (row.workspace_id as string) ?? null,
    }))
}

/** A selectable app, carrying its host workspace so a new chat can be scoped to (workspace, app). */
export interface OrgAppOption {
  projectId: string
  name: string
  icon: string | null
  workspaceId: string
  workspaceName: string
}

/**
 * Flat list of every app the user can reach in an org, each labeled with its workspace. Backs the
 * landing composer's app picker (start a new conversation inside an existing app). Resolves the
 * org's workspaces, then each workspace's apps (folders excluded), RLS-scoped throughout.
 */
export async function fetchAppsForOrg(orgId: string): Promise<OrgAppOption[]> {
  const workspaces = await fetchWorkspacesForOrgs([orgId])
  const perWorkspace = await Promise.all(
    workspaces.map(async (ws) => {
      const projects = await fetchProjects(ws.id)
      return projects
        .filter((p) => p.entityType === 'app')
        .map<OrgAppOption>((p) => ({
          projectId: p.id,
          name: p.name,
          icon: p.icon,
          workspaceId: ws.id,
          workspaceName: ws.name,
        }))
    }),
  )
  return perWorkspace.flat()
}

// ── Additional exports required by shell hooks ────────────────────────────────────────────────

export interface AppNode {
  id: string
  name: string
  status: string
}

export interface WorkspaceNode {
  id: string
  name: string
  apps: AppNode[]
}

/** An org node with nested workspaces and apps (used by useExplorer / Explorer UI). */
export interface OrgNode {
  id: string
  name: string
  workspaces: WorkspaceNode[]
}

/**
 * Fetch the full org/workspace/app tree for a user.
 * Stub: returns empty array until the real endpoint is wired.
 */
export async function fetchTree(_userId: string): Promise<OrgNode[]> {
  return []
}

/** Fetch chats for a given app. Stub: delegates to fetchProjectChats. */
export async function fetchChatsForApp(appId: string): Promise<ChatNode[]> {
  return fetchProjectChats(appId)
}
