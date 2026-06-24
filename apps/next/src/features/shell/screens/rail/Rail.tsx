import { useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import iconDark from '@/assets/logo/icon-dark.png'
import iconLight from '@/assets/logo/icon-light.png'
import { Files, History, Network, Search, Settings, Store, Users } from 'lucide-react'
import { Kbd, Separator } from '@heroui/react'
import { useUiStore, type RailMode } from '@/state/uiStore'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useOrganizations } from '../../hooks/useOrganizations'
import { useWalletBalance } from '../../hooks/useWalletBalance'
import {
  useCreateOrganization,
  useCreateWorkspace,
  useWorkspaces,
} from '../../hooks/useWorkspaces'
import { useShellStrings } from '../../i18n'
import { RailButton } from '../../components/rail/RailButton'
import { OrgSwitcher } from '../../components/rail/OrgSwitcher'
import { CreditsReadout } from '../../components/rail/CreditsReadout'
import { InviteModal } from '../../components/rail/InviteModal'
import { ProfileMenu } from '../../components/rail/ProfileMenu'

// The always-on left rail: identity + navigation spine. Composes the data-backed chrome
// (org switcher, modes, credits, profile) over the core/* seam. Width 56px, never moves/hides.
// Org-bound actions are gated until the session resolves (readiness gate — shell-loading parity).
const MODES: { id: RailMode; icon: typeof Network }[] = [
  { id: 'explorer', icon: Network },
  { id: 'files', icon: Files },
  { id: 'people', icon: Users },
  { id: 'history', icon: History },
  { id: 'settings', icon: Settings },
]

const MANAGE_ROLES = new Set(['owner', 'admin'])
// Shared with the legacy app's same-origin selection keys so a future island Explorer/Stage (or the
// legacy shell) reads the active scope (legacy: lib/org/switchOrganization, hooks/workspace).
const ORG_STORAGE_KEY = 'bos-current-org'
const WORKSPACE_STORAGE_KEY = 'vbp-current-workspace'

function persistScope(orgId: string, workspaceId: string) {
  try {
    localStorage.setItem(ORG_STORAGE_KEY, orgId)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId)
  } catch {
    // localStorage may be unavailable (private mode); selection still lives in state.
  }
}

export function Rail() {
  const t = useShellStrings()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: sessionLoading } = useCurrentUser()
  const activeMode = useUiStore((s) => s.activeMode)
  const setActiveMode = useUiStore((s) => s.setActiveMode)
  const setCanvasPage = useUiStore((s) => s.setCanvasPage)
  const preSettingsPath = useUiStore((s) => s.preSettingsPath)
  const setPreSettingsPath = useUiStore((s) => s.setPreSettingsPath)
  // uiStore is the single source of truth for the active org — Rail reads AND writes it.
  // This keeps the Rail, ChatPane (useResolvedOrgId), and CreditsReadout in sync without
  // any secondary selectedOrgId state that diverges on page load.
  const activeOrgId = useUiStore((s) => s.activeOrgId)
  const setActiveOrgId = useUiStore((s) => s.setActiveOrgId)

  const orgsQuery = useOrganizations(user?.id)
  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data])

  // currentOrg: explicit pick from uiStore → first org fallback (matches useResolvedOrgId logic).
  const currentOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null
  const walletQuery = useWalletBalance(currentOrg?.id)

  // Workspaces for the user's orgs (scoped per org inside the switcher).
  const orgIds = useMemo(() => orgs.map((o) => o.id), [orgs])
  const workspacesQuery = useWorkspaces(orgIds)
  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data])
  const createWorkspace = useCreateWorkspace()
  const createOrganization = useCreateOrganization()

  // Active workspace: restored from localStorage so a page reload keeps the selection.
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    try { return localStorage.getItem(WORKSPACE_STORAGE_KEY) } catch { return null }
  })
  const currentWorkspaceId =
    (selectedWorkspaceId &&
      workspaces.find((w) => w.id === selectedWorkspaceId)?.organizationId === currentOrg?.id
      ? selectedWorkspaceId
      : null) ??
    workspaces.find((w) => w.organizationId === currentOrg?.id)?.id ??
    null

  // Admin-only affordances (create org/workspace, org-management nav) — owner/admin of any org.
  const canManage = orgs.some((o) => MANAGE_ROLES.has(o.role ?? ''))

  const switchScope = useCallback((orgId: string, workspaceId: string) => {
    // Org change → leave the old org's project/chat screen (its tabs/preview reset in the store);
    // land on the home composer so the current screen reflects the new scope.
    const orgChanged = orgId !== useUiStore.getState().activeOrgId
    setSelectedWorkspaceId(workspaceId)
    setActiveOrgId(orgId)
    persistScope(orgId, workspaceId)
    if (orgChanged) navigate('/')
  }, [setActiveOrgId, navigate])

  // Open an org-settings section (remembering where we were so the Settings exit restores it),
  // matching onOpenOrgSettings. Used by the billing actions in the org switcher + credits popover.
  const openSettingsSection = useCallback((section: string) => {
    setPreSettingsPath(location.pathname + location.search)
    setActiveMode('settings')
    navigate(`/settings/org?section=${section}`)
  }, [location.pathname, location.search, navigate, setActiveMode, setPreSettingsPath])

  // Readiness gate: org-bound actions (org/credits/invite/profile) wait for the session.
  const gated = sessionLoading

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-overlay/30 py-2"
    >
      {/* macOS Electron: 28px drag zone at the top clears the traffic-light cluster (y=14).
          Activated only when the .electron class is on <html>; no-op in the browser. */}
      <div className="electron-titlebar w-full" aria-hidden="true" />
      <img
        src={iconLight}
        alt="Logo"
        className="mb-1 size-8 opacity-95 shrink-0 dark:block hidden"
        aria-hidden="true"
      />
      <img
        src={iconDark}
        alt="Logo"
        className="mb-1 size-7 shrink-0 dark:hidden"
        aria-hidden="true"
      />
      <OrgSwitcher
        orgs={orgs}
        workspaces={workspaces}
        currentOrg={currentOrg}
        currentWorkspaceId={currentWorkspaceId}
        loading={orgsQuery.isLoading}
        disabled={gated}
        canManage={canManage}
        onSwitchWorkspace={switchScope}
        onCreateWorkspace={async (orgId, name) => {
          const { workspaceId } = await createWorkspace.mutateAsync({ orgId, name })
          switchScope(orgId, workspaceId)
        }}
        onCreateOrganization={async (name) => {
          const { organizationId, workspaceId } = await createOrganization.mutateAsync({ name })
          // BW157: switch using the returned workspace id directly (it may not yet be in the
          // refetched list). Org id alone still selects the org; workspace resolves on refetch.
          setActiveOrgId(organizationId)
          if (workspaceId) switchScope(organizationId, workspaceId)
        }}
        onOpenOrgSettings={() => {
          setPreSettingsPath(location.pathname + location.search)
          setActiveMode('settings')
          navigate('/settings/org?section=general')
        }}
        onOpenPeople={() => setActiveMode('people')}
        onOpenBilling={() => openSettingsSection('billing')}
      />

      <Separator className="w-6" />

      <div className="flex flex-col gap-0.5">
        {MODES.map(({ id, icon: Icon }) => (
          <RailButton
            key={id}
            aria-label={t.rail.mode[id]}
            label={t.rail.mode[id]}
            icon={<Icon className="size-5 text-muted" />}
            active={activeMode === id}
            onPress={() => {
              if (id === 'settings') {
                setPreSettingsPath(location.pathname + location.search)
                setActiveMode('settings')
                navigate('/settings/profile')
              } else {
                if (activeMode === 'settings') navigate(preSettingsPath)
                setActiveMode(id as RailMode)
              }
            }}
          />
        ))}
        <RailButton
          aria-label={t.rail.mode.marketplace}
          label={t.rail.mode.marketplace}
          icon={<Store className="size-5 text-muted" />}
          onPress={() => setCanvasPage({ id: 'marketplace', label: t.rail.mode.marketplace })}
        />
      </div>

      <div className="flex-1" />

      <RailButton
        aria-label={t.rail.search}
        label={t.rail.search}
        icon={<Search className="size-5 text-muted" />}
        tooltip={
          <span className="flex items-center gap-2">
            {t.rail.search}
            <Kbd>
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>K</Kbd.Content>
            </Kbd>
          </span>
        }
        onPress={() => {
          // TODO: open the command palette (own surface, not yet built).
        }}
      />

      <CreditsReadout
        balance={walletQuery.data}
        loading={walletQuery.isLoading}
        disabled={gated}
        orgName={currentOrg?.name ?? null}
        onOpenBilling={(target) => openSettingsSection(target === 'usage' ? 'usage' : 'billing')}
      />

      <InviteModal user={user} currentOrg={currentOrg} disabled={gated} />

      <Separator className="w-6" />

      <ProfileMenu
        user={user}
        currentOrg={currentOrg}
        balance={walletQuery.data}
        loading={sessionLoading}
        disabled={gated}
      />
    </nav>
  )
}
