import { useQuery } from '@tanstack/react-query'
import { fetchPreviewMetadata, type PreviewMetadata } from '@/core/preview'
import type { SelectedNode } from '@/state/uiStore'

export function usePreviewMetadata(node: SelectedNode | null) {
  const appId = node?.kind === 'app' ? node.id : node?.appId
  const chatId = node?.kind === 'chat' ? node.id : null
  const appName = node?.kind === 'app' ? node.name : node?.appName

  return useQuery<PreviewMetadata>({
    queryKey: ['canvas', 'preview-metadata', appId ?? null, chatId ?? null],
    queryFn: () => fetchPreviewMetadata({ appId: appId as string, chatId, appName }),
    enabled: Boolean(appId),
    staleTime: 15_000,
  })
}
