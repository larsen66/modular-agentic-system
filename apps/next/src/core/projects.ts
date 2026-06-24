import { supabase } from './supabase'
import { fetchOrganizations } from './orgs'
import { fetchWorkspacesForOrgs, createWorkspace } from './workspaces'

// Project + chat creation seam (the write side of the Explorer tree). Island-side recreation of the
// legacy create flow. Contract source: legacy `src/hooks/chat/useChatToApp.ts` (project insert),
// `src/hooks/projects/useProjectChats.ts` (chat insert + membership RPC).
//
// A project row in `user_mini_apps` (its id IS the projectId IS the node source_id); server-side
// triggers mirror it into `v_nodes`/`node_links` so it appears in the Explorer tree. Org scoping is
// via `workspace_id → workspaces.organization_id` (no org column on this table).

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  return userId
}

/** Create a project (app node) under a workspace. Returns its id (= projectId). */
export async function createProject(params: {
  workspaceId: string
  name: string
  prompt?: string
}): Promise<{ projectId: string }> {
  const userId = await currentUserId()
  const name = (params.name.trim() || 'New App').slice(0, 60)
  const prompt = params.prompt?.trim() || null
  const { data, error } = await supabase
    .from('user_mini_apps')
    .insert({
      user_id: userId,
      workspace_id: params.workspaceId,
      name,
      icon: '🚀',
      description: prompt,
      prompt,
      type: 'generated',
      chat_history: [],
      is_public: false,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createProject failed: ${error.message}`)
  return { projectId: (data as { id: string }).id }
}

/** Create a chat (thread) under a project. Ensures workspace membership first (legacy parity). */
export async function createChat(params: {
  projectId: string
  workspaceId: string
  title?: string
  kind?: 'main' | 'branch' | 'scratch' | 'task-run'
  parentChatId?: string
}): Promise<{ chatId: string }> {
  const userId = await currentUserId()
  // Best-effort membership ensure before insert (legacy parity, avoids an RLS denial). The shared
  // generated types carry a stale signature for this RPC; the runtime arg is `p_workspace_id` (see
  // legacy useProjectChats.ts), so the arg object is cast to satisfy the checker.
  await supabase.rpc('ensure_my_workspace_membership', {
    p_workspace_id: params.workspaceId,
  } as never)
  const kind = params.kind ?? 'branch'
  const { data, error } = await supabase
    .from('project_chats')
    .insert({
      project_id: params.projectId,
      workspace_id: params.workspaceId,
      created_by: userId,
      title: params.title ?? 'New Chat',
      kind,
      status: 'active',
      messages: [],
      ...(params.parentChatId ? { parent_chat_id: params.parentChatId } : {}),
    })
    .select('id')
    .single()
  if (error) {
    // One main chat per (project, workspace): on a unique violation, return the existing main.
    if ((error as { code?: string }).code === '23505' && kind === 'main') {
      const existing = await findMainChat(params.projectId, params.workspaceId)
      if (existing) return { chatId: existing }
    }
    throw new Error(`createChat failed: ${error.message}`)
  }
  return { chatId: (data as { id: string }).id }
}

async function findMainChat(projectId: string, workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('project_chats')
    .select('id')
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .eq('kind', 'main')
    .limit(1)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Resolve the project's main chat, creating it if absent. */
export async function ensureMainChat(
  projectId: string,
  workspaceId: string,
): Promise<{ chatId: string }> {
  const existing = await findMainChat(projectId, workspaceId)
  if (existing) return { chatId: existing }
  return createChat({ projectId, workspaceId, title: 'Main', kind: 'main' })
}

/**
 * Resolve the org + workspace to bootstrap a new project into (the "create from prompt" path when no
 * project is selected). Prefers the given org, else the user's first; prefers an existing workspace,
 * else creates one. Legacy parity: `useChatToApp.bootstrapFromChat` workspace resolution.
 */
export async function resolveBootstrapTarget(
  preferredOrgId?: string | null,
): Promise<{ orgId: string; workspaceId: string }> {
  const userId = await currentUserId()
  const orgs = await fetchOrganizations(userId)
  if (orgs.length === 0) throw new Error('No organization available')
  const org = orgs.find((o) => o.id === preferredOrgId) ?? orgs[0]
  const workspaces = await fetchWorkspacesForOrgs([org.id])
  const existing = workspaces.find((w) => w.organizationId === org.id) ?? workspaces[0]
  if (existing) return { orgId: org.id, workspaceId: existing.id }
  const created = await createWorkspace({ orgId: org.id, name: 'My Workspace' })
  return { orgId: org.id, workspaceId: created.workspaceId }
}
