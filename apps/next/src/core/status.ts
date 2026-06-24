import { supabase } from './supabase'

// Project and chat health-state seam for Explorer tree indicators. These are lightweight polling
// snapshots — not real-time subscriptions. React hooks in features/shell wrap these with react-query
// and short poll intervals. All Supabase access stays here (ARCHITECTURE §5 rule 3).
//
// Session model: `opencode_sessions` tracks conversation scope with status `'active'|'paused'|'archived'`.
// Runner container health (ready/degraded/error) is not stored in Supabase — it lives in the runner
// HTTP API. Health is therefore derived from:
//   - Whether an active opencode_session exists for the project (session exists + not archived)
//   - Whether any run row is currently in progress for that project

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProjectHealthState =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'error'
  | 'ready'
  | 'degraded'

export type ChatAttentionState = 'none' | 'running' | 'needs-input' | 'unread' | 'error'

export interface ProjectStatus {
  projectId: string
  health: ProjectHealthState
  writeLocked: boolean
  /** The chat currently being worked on (from an in-progress run), or null. */
  activeChatId: string | null
}

export interface ChatStatus {
  chatId: string
  attention: ChatAttentionState
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map opencode_sessions.status ('active'|'paused'|'archived') + run presence to a health state.
 * Runner container health is NOT in Supabase — we can only show coarse presence/absence here.
 */
function mapSessionStatusToHealth(
  sessionStatus: string | null | undefined,
  hasActiveRun: boolean,
): ProjectHealthState {
  if (!sessionStatus || sessionStatus === 'archived') return 'idle'
  if (sessionStatus === 'paused') return 'idle'
  // 'active': session exists and is in use. If a run is in progress → 'running'; else → 'ready'.
  if (sessionStatus === 'active') return hasActiveRun ? 'running' : 'ready'
  return 'idle'
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch health status for all projects in a workspace, derived from their sessions + active runs.
 * Graceful — returns [] on any error rather than throwing to the caller.
 */
export async function fetchProjectStatuses(workspaceId: string): Promise<ProjectStatus[]> {
  try {
    // `host_workspace_id` is the correct column name — `workspace_id` does not exist.
    // `active/paused` sessions are "live" for display purposes; `archived` → idle.
    const { data: sessionRows, error: sessionError } = await supabase
      .from('opencode_sessions')
      .select('id, project_id, status, host_workspace_id')
      .eq('host_workspace_id', workspaceId)
      .neq('status', 'archived')

    if (sessionError) return []

    const projectIds = (sessionRows ?? [])
      .map((s) => (s as { project_id: string }).project_id)
      .filter(Boolean)

    // Find in-progress runs and their active chat — both for writeLocked and activeChatId.
    let runningProjectIds = new Set<string>()
    const activeChatByProject = new Map<string, string>()

    if (projectIds.length > 0) {
      const { data: runRows } = await supabase
        .from('runs')
        .select('id, project_id, chat_id, status')
        .in('project_id', projectIds)
        .in('status', ['running', 'streaming', 'pending'])

      if (runRows) {
        for (const r of runRows) {
          const pid = r.project_id as string
          const cid = r.chat_id as string | null
          if (pid) runningProjectIds.add(pid)
          if (pid && cid && !activeChatByProject.has(pid)) {
            activeChatByProject.set(pid, cid)
          }
        }
      }
    }

    return (sessionRows ?? []).map((session) => {
      const s = session as { project_id: string; status: string }
      const projectId = s.project_id
      const hasActiveRun = runningProjectIds.has(projectId)
      const health = mapSessionStatusToHealth(s.status, hasActiveRun)
      const writeLocked = hasActiveRun && s.status === 'active'

      return {
        projectId,
        health,
        writeLocked,
        activeChatId: activeChatByProject.get(projectId) ?? null,
      }
    })
  } catch {
    return []
  }
}

/**
 * Fetch attention states for all chats in a project. Graceful — returns [] on any error.
 */
export async function fetchChatStatuses(projectId: string): Promise<ChatStatus[]> {
  try {
    const { data: chatRows, error: chatError } = await supabase
      .from('project_chats')
      .select('id, status')
      .eq('project_id', projectId)
      .neq('status', 'archived')

    if (chatError || !chatRows) return []

    const chatIds = chatRows.map((c) => (c as { id: string }).id)

    let activeChatIds = new Set<string>()

    if (chatIds.length > 0) {
      const { data: runRows } = await supabase
        .from('runs')
        .select('chat_id')
        .in('chat_id', chatIds)
        .in('status', ['running', 'streaming', 'pending'])

      if (runRows) {
        activeChatIds = new Set(runRows.map((r) => (r as { chat_id: string }).chat_id))
      }
    }

    return chatRows.map((chat) => {
      const chatId = (chat as { id: string }).id
      const attention: ChatAttentionState = activeChatIds.has(chatId) ? 'running' : 'none'
      return { chatId, attention }
    })
  } catch {
    return []
  }
}
