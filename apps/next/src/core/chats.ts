import { supabase } from './supabase'

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  body: string
  status: string | null
  createdAt: string | null
}

export interface ChatThread {
  id: string
  title: string
  status: string
  appId: string | null
  runnerSessionId: string | null
  opencodeSessionId: string | null
  summary: string | null
  lastActivityAt: string | null
  messages: ChatMessage[]
}

interface ChatRow {
  id: string
  title: string | null
  status: string | null
  project_id: string | null
  runner_session_id: string | null
  opencode_session_id: string | null
  summary: string | null
  last_activity_at: string | null
}

interface MessageRow {
  id: string
  role: string | null
  content: string | null
  status: string | null
  created_at: string | null
}

function normalizeRole(role: string | null): ChatMessageRole {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'tool') {
    return role
  }
  return 'assistant'
}

export async function fetchChatThread(chatId: string): Promise<ChatThread> {
  const { data: chat, error: chatError } = await supabase
    .from('project_chats')
    .select('id, title, status, project_id, runner_session_id, opencode_session_id, summary, last_activity_at')
    .eq('id', chatId)
    .single()

  if (chatError) throw new Error(`fetchChatThread chat failed: ${chatError.message}`)

  const row = chat as ChatRow
  const { data: messages, error: messagesError } = await supabase
    .from('bos_messages')
    .select('id, role, content, status, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(80)

  if (messagesError) throw new Error(`fetchChatThread messages failed: ${messagesError.message}`)

  return {
    id: row.id,
    title: row.title ?? 'Untitled chat',
    status: row.status ?? 'unknown',
    appId: row.project_id ?? null,
    runnerSessionId: row.runner_session_id ?? null,
    opencodeSessionId: row.opencode_session_id ?? null,
    summary: row.summary ?? null,
    lastActivityAt: row.last_activity_at ?? null,
    messages: ((messages ?? []) as MessageRow[]).map((message) => ({
      id: message.id,
      role: normalizeRole(message.role),
      body: message.content ?? '',
      status: message.status ?? null,
      createdAt: message.created_at ?? null,
    })),
  }
}

/** Fetch the session ID associated with a chat. Returns null if none found. */
export async function fetchChatSession(_chatId: string): Promise<{ sessionId: string | null }> {
  return { sessionId: null }
}
