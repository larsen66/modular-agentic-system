import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchProjects, fetchProjectChats } from '@/core/explorer'
import { WORKSPACE_QS } from '@/lib/route'

// Breadcrumb data for the chat header: the active project's name + the active chat's title. Reads
// the same route authority as useChat (projectId/chatId from the path, workspaceId from the query)
// and resolves the display names through the proven Explorer fetchers (RLS-correct, and usually a
// warm react-query cache hit since the Explorer already loaded them). Null until resolved / when
// nothing is selected — the header falls back gracefully.
export function useChatHeader() {
  const params = useParams()
  const [sp] = useSearchParams()
  const projectId = params.projectId ?? null
  const chatId = params.chatId ?? null
  const workspaceId = sp.get(WORKSPACE_QS)

  const projects = useQuery({
    queryKey: ['shell', 'projects', workspaceId],
    queryFn: () => fetchProjects(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  })
  const chats = useQuery({
    queryKey: ['shell', 'projectChats', projectId ?? null, workspaceId ?? null],
    queryFn: () => fetchProjectChats(projectId as string, workspaceId),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  })

  return {
    projectId,
    chatId,
    projectName: projects.data?.find((p) => p.id === projectId)?.name ?? null,
    chatTitle: chats.data?.find((c) => c.id === chatId)?.name ?? null,
  }
}
