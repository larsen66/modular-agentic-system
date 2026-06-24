import { runnerFetch, runnerJson } from './runner'

// Model catalog seam. Island-side recreation of the legacy models contract.
// Contract source: legacy `src/hooks/useModels.ts`; runner
// `runner-service/src/routes/workspace.routes.ts` (catalog 534 / session models 574 / default 635).

export interface ModelInfo {
  provider: string
  model: string
  displayName: string
  available: boolean
  maker?: string
  pricing?: { prompt?: string | null; completion?: string | null }
  contextLength?: number | null
  effortLevels?: string[]
  accessRoute?: string
  health?: string
  inEnvelope?: boolean
}

export interface ModelsConfig {
  models: ModelInfo[]
  defaultProvider?: string
  defaultModel?: string
  modelsReady?: boolean
  [k: string]: unknown
}

export interface FetchModelsParams {
  sessionId?: string | null
  /** Live runner session status — only `ready` + docker + chatAccepting uses the live CLI list. */
  status?: string
  runtime?: string
  chatAccepting?: boolean
  projectId?: string | null
  hostWorkspaceId?: string | null
  surfaceKey?: string | null
}

/**
 * Fetch the model catalog. Uses the live container list (`GET /sessions/:id/models`) only when the
 * session is docker + ready + chat-accepting; otherwise the static catalog (`GET /models/catalog`,
 * works anonymously). This mirrors the legacy `chatAccepting` gate that avoids the slow
 * `opencode models` CLI call during cold bootstrap.
 */
export async function fetchModels(params: FetchModelsParams): Promise<ModelsConfig> {
  const live =
    params.sessionId &&
    params.status === 'ready' &&
    params.runtime === 'docker' &&
    params.chatAccepting !== false
  if (live) {
    return runnerJson<ModelsConfig>(`/sessions/${params.sessionId}/models`)
  }
  const qs = new URLSearchParams()
  if (params.projectId) qs.set('projectId', params.projectId)
  if (params.hostWorkspaceId) qs.set('hostWorkspaceId', params.hostWorkspaceId)
  if (params.surfaceKey) qs.set('surfaceKey', params.surfaceKey)
  const q = qs.toString()
  return runnerJson<ModelsConfig>(`/models/catalog${q ? `?${q}` : ''}`)
}

/** POST /sessions/:id/models/default — pin the session's default model (the "Make default" action). */
export async function setDefaultModel(
  sessionId: string,
  provider: string,
  model: string,
): Promise<void> {
  await runnerFetch(`/sessions/${sessionId}/models/default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  })
}
