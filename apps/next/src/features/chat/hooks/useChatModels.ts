import { useEffect, useState } from 'react'
import { fetchModels, type ModelInfo, type ModelsConfig } from '@/core/models'

// Model catalog for the switcher. Re-fetches when chat-readiness flips (catalog → live container
// list). Recreated from legacy useModels (the chatAccepting gate is in core/models.fetchModels).

export interface ChatModelsState {
  models: ModelInfo[]
  config: ModelsConfig | null
  loading: boolean
}

export function useChatModels(input: {
  sessionId: string | null
  status: string | null
  runtime: string | null
  chatAccepting: boolean
  projectId: string | null
  hostWorkspaceId: string | null
  surfaceKey: string | null
}): ChatModelsState {
  const [config, setConfig] = useState<ModelsConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const { sessionId, status, runtime, chatAccepting, projectId, hostWorkspaceId, surfaceKey } = input

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchModels({
      sessionId,
      status: status ?? undefined,
      runtime: runtime ?? undefined,
      chatAccepting,
      projectId,
      hostWorkspaceId,
      surfaceKey,
    })
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch(() => {
        /* keep last config; switcher falls back to whatever is loaded */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, status, runtime, chatAccepting, projectId, hostWorkspaceId, surfaceKey])

  const models = (config?.models ?? []).filter((m) => m.available)
  return { models, config, loading }
}
