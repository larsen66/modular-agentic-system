// Island URL scheme (cross-cutting, pure — usable by any feature). Mirrors the legacy canonical
// route (ADR 0032): /project/:projectId/chat/:chatId with workspace + surface context in the query.
// Contract source: legacy `src/lib/openProjectRoute.ts`. The URL is the SOLE authority for the
// active project/chat (never mirror it as primary component state).

export const WORKSPACE_QS = 'workspaceId'
export const SURFACE_KEY_QS = 'surfaceKey'

/** Owner surface key for an owned project in a workspace (legacy `deriveOwnerSurfaceKey`). */
export function ownerSurfaceKey(projectId: string, workspaceId: string): string {
  return `owner:${projectId}:${workspaceId}`
}

export interface ProjectRouteOpts {
  chatId?: string | null
  workspaceId?: string | null
  surfaceKey?: string | null
}

/** Build the canonical path for a project (+ optional chat) with workspace/surface query context. */
export function projectChatPath(projectId: string, opts: ProjectRouteOpts = {}): string {
  const base = opts.chatId
    ? `/project/${projectId}/chat/${opts.chatId}`
    : `/project/${projectId}`
  const qs = new URLSearchParams()
  if (opts.workspaceId) qs.set(WORKSPACE_QS, opts.workspaceId)
  // Drop a stale owner: surfaceKey that belongs to a different project (cross-project leak guard).
  if (opts.surfaceKey && isSurfaceKeyForProject(opts.surfaceKey, projectId)) {
    qs.set(SURFACE_KEY_QS, opts.surfaceKey)
  }
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

/** True if an `owner:{projectId}:{workspaceId}` key targets this project (mount: keys always pass). */
export function isSurfaceKeyForProject(surfaceKey: string, projectId: string): boolean {
  if (!surfaceKey.startsWith('owner:')) return true
  return surfaceKey.split(':')[1] === projectId
}
