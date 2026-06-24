import { supabase } from './supabase'

// Write operations for the Explorer tree (rename + delete). These are the supabase mutations that
// back the context-action menu items in WorkspaceBranch / ProjectBranch / ChatRow. All mutations
// are simple single-table operations; RLS governs access.

// ── Workspace ─────────────────────────────────────────────────────────────────

/** Rename a workspace (by id). Returns the updated name on success. */
export async function renameWorkspace(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty')
  const { error } = await supabase.from('workspaces').update({ name: trimmed }).eq('id', id)
  if (error) throw new Error(`renameWorkspace failed: ${error.message}`)
}

// ── Project (app/folder node) ─────────────────────────────────────────────────

/** Rename a project node (user_mini_apps + reflected into v_nodes via trigger). */
export async function renameProject(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty')
  const { error } = await supabase.from('user_mini_apps').update({ name: trimmed }).eq('id', id)
  if (error) throw new Error(`renameProject failed: ${error.message}`)
}

/** Delete a project node and its chats (cascades via DB). */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('user_mini_apps').delete().eq('id', id)
  if (error) throw new Error(`deleteProject failed: ${error.message}`)
}

// ── Chat ─────────────────────────────────────────────────────────────────────

/** Rename a chat (project_chats.title). */
export async function renameChat(id: string, title: string): Promise<void> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Title cannot be empty')
  const { error } = await supabase.from('project_chats').update({ title: trimmed }).eq('id', id)
  if (error) throw new Error(`renameChat failed: ${error.message}`)
}

/** Soft-delete a chat by archiving it (preferred) or hard-delete. */
export async function deleteChat(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_chats')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) throw new Error(`deleteChat failed: ${error.message}`)
}
