import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useUiStore } from '@/state/uiStore'

// The URL is the authority for the active project/chat; this mirrors it into the cross-cutting UI
// store so the Explorer can highlight the selected node/chat. Renders nothing.
export function RouteSelectionSync() {
  const params = useParams()
  const applyRouteSelection = useUiStore((s) => s.applyRouteSelection)
  const projectId = params.projectId ?? null
  const chatId = params.chatId ?? null
  useEffect(() => {
    applyRouteSelection(projectId, chatId)
  }, [projectId, chatId, applyRouteSelection])
  return null
}
