import { useQuery } from '@tanstack/react-query'
import { fetchChatThread, type ChatThread } from '@/core/chats'

export function useChatThread(chatId: string | null | undefined) {
  return useQuery<ChatThread>({
    queryKey: ['chat', 'thread', chatId ?? null],
    queryFn: () => fetchChatThread(chatId as string),
    enabled: Boolean(chatId),
    staleTime: 15_000,
  })
}
