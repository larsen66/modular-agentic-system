import { Box, Plus } from 'lucide-react'
import { ModelPicker } from '@/components/agent-elements/input/model-picker'
import { useChatStrings } from '../i18n'
import { useResolvedOrgId } from '../hooks/useOrgBalance'
import { useOrgApps } from '../hooks/useOrgApps'
import { useSelectionStore } from '../state/selectionStore'

// Landing-state app picker: choose which existing app a new conversation starts in, or leave it on
// "New app" to bootstrap a fresh one from the prompt. Visually identical to the composer's model
// picker — it reuses the same ModelPicker component (searchable list, no pins). The workspace name
// rides along as the dimmed `version` label so apps stay disambiguated across workspaces.

const SEP = '::'
const NEW_APP = 'new-app'

export function AppSwitcher({ currentProjectId }: { currentProjectId?: string | null }) {
  const t = useChatStrings()
  const orgId = useResolvedOrgId()
  const { data: apps = [] } = useOrgApps(orgId)
  const target = useSelectionStore((s) => s.landingTarget)
  const setTarget = useSelectionStore((s) => s.setLandingTarget)

  const options = [
    { id: NEW_APP, name: t.appPicker.newApp, icon: Plus },
    ...apps.map((a) => ({
      id: `${a.workspaceId}${SEP}${a.projectId}`,
      name: a.name,
      // Workspace the app lives in — shown as the dim secondary label in both trigger and list.
      version: a.workspaceName,
      icon: Box,
    })),
  ]
  // Explicit pick wins; otherwise default to the current project (when we're inside one) so the
  // picker reads as "this app", falling back to "New app" on the home composer.
  const currentApp = currentProjectId
    ? apps.find((a) => a.projectId === currentProjectId)
    : undefined
  const value = target
    ? `${target.workspaceId}${SEP}${target.projectId}`
    : currentApp
      ? `${currentApp.workspaceId}${SEP}${currentApp.projectId}`
      : NEW_APP

  return (
    <ModelPicker
      models={options}
      value={value}
      searchable
      placeholder={t.appPicker.newApp}
      searchPlaceholder={t.appPicker.search}
      emptyLabel={t.appPicker.empty}
      onChange={(id) => {
        if (id === NEW_APP) {
          setTarget(null)
          return
        }
        const sep = id.indexOf(SEP)
        if (sep === -1) return
        const workspaceId = id.slice(0, sep)
        const projectId = id.slice(sep + SEP.length)
        const app = apps.find((a) => a.projectId === projectId && a.workspaceId === workspaceId)
        setTarget({ projectId, workspaceId, label: app?.name ?? t.appPicker.newApp })
      }}
    />
  )
}
