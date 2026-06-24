import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Button, Chip, Description, FieldError, FieldGroup, Fieldset, Form,
  Input, Label, ListBox, Modal, ScrollShadow, Select, Separator, Spinner, Surface,
  TextArea, TextField, ToggleButton, ToggleButtonGroup, Tabs, Switch,
} from '@heroui/react'
import { Sun, Moon, Monitor, LogOut, Search, ChevronLeft, ChevronRight, Upload, Shield, Lock, ExternalLink, Check } from 'lucide-react'
import { runnerFetch } from '@/core/runner'
import { supabase } from '@/core/supabase'
import { OrgKnowledgeSection } from './OrgKnowledgeSection'
import { BillingSection } from './BillingSection'
import { useActiveOrg } from '../../hooks/useActiveOrg'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useUiStore, type ThemePref } from '@/state/uiStore'
import { signOut } from '@/core/session'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import {
  fetchUserProfile,
  updateUserFullName,
  fetchUserPreferences,
  updateUserPreference,
  uploadUserAvatar,
  fetchOrgGeneralInfo,
  saveOrgGeneralInfo,
  fetchOrgInvitations,
  fetchOrgWorkspaces,
  fetchWsGeneralInfo,
  saveWsGeneralInfo,
  fetchWorkspaceMembers,
  changeOrgMemberRole,
  removeOrgMember,
  revokeInvitation,
  inviteMember,
  fetchOrgDefaultMemberRole,
  saveOrgDefaultMemberRole,
  saveOrgSelfRegistration,
  fetchOrgCredentialStatus,
  updateOrgCredentialsPartial,
  fetchRootLandingStatus,
  setRootLanding,
  fetchOrgRunVisibility,
  saveOrgRunVisibility,
} from '@/core/settings'
import { fetchOrgMembers } from '@/core/orgs'
import type { OrgMember } from '@/core/orgs'
import type { OrgInvitation, WorkspaceMember, WsGeneralInfo, OrgGeneralInfo, UserProfile, OrgWorkspace, OrgCredentialStatus, OrgNodeVisibility, OrgRunVisibility } from '@/core/settings'

const LANG_LABEL: Record<string, string> = { en: 'English', de: 'Deutsch' }

function resolveSection(pathname: string, search: string): string {
  const sp = new URLSearchParams(search)
  const section = sp.get('section')
  if (section) return section
  if (pathname.startsWith('/settings/org')) return 'general'
  if (pathname.startsWith('/settings/workspace')) return 'ws-general'
  return 'profile'
}

// ─── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetchUserProfile(userId),
      fetchUserPreferences(userId),
    ]).then(([p, prefs]) => {
      setProfile(p)
      setFullName(p?.fullName ?? '')
      setAvatarUrl(prefs?.avatarUrl ?? p?.avatarUrl ?? null)
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [userId])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadUserAvatar(userId, file)
      await updateUserPreference(userId, 'avatarUrl', url)
      setAvatarUrl(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateUserFullName(userId, fullName.trim())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
      </Surface>
    )
  }

  const initials = (profile.fullName ?? profile.email ?? userId)[0]?.toUpperCase() ?? '?'

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>Profile</Fieldset.Legend>
          <Description>Your personal identity shown to other members.</Description>
          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
            </Alert>
          )}
          <div className="flex items-center gap-4 py-2">
            <Avatar size="lg">
              {avatarUrl && <Avatar.Image src={avatarUrl} alt={profile.fullName ?? ''} />}
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={uploading}
                onPress={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                {uploading ? 'Uploading…' : 'Upload photo'}
              </Button>
              <p className="text-xs text-muted">JPG, PNG or GIF. Max 5 MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>
          <FieldGroup>
            <TextField name="fullName" value={fullName} onChange={setFullName}>
              <Label>Full name</Label>
              <Input variant="secondary" placeholder="Jane Doe" />
              <FieldError />
            </TextField>
            <TextField name="email" isReadOnly value={profile.email ?? ''}>
              <Label>Email</Label>
              <Input variant="secondary" />
              <Description>Your account email cannot be changed here.</Description>
            </TextField>
            <TextField name="userId" isReadOnly value={userId}>
              <Label>User ID</Label>
              <Input variant="secondary" className="font-mono text-xs" />
              <Description>Your unique account identifier.</Description>
            </TextField>
          </FieldGroup>
          <Fieldset.Actions>
            <Button
              type="button"
              variant="tertiary"
              isDisabled={saving}
              onPress={() => setFullName(profile.fullName ?? '')}
            >
              Cancel
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </Form>
    </Surface>
  )
}

// ─── Appearance section ────────────────────────────────────────────────────────

function AppearanceSection({ userId }: { userId: string }) {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)

  async function handleThemeChange(next: ThemePref) {
    setTheme(next)
    try { await updateUserPreference(userId, 'theme', next) } catch { /* best-effort DB sync */ }
  }

  async function handleLanguageChange(key: string) {
    if (key !== 'en' && key !== 'de') return
    setLanguage(key)
    try { await updateUserPreference(userId, 'language', key) } catch { /* best-effort DB sync */ }
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Appearance</Fieldset.Legend>
        <Description>Theme and language preferences. Changes apply immediately.</Description>
        <FieldGroup>
          <div className="flex items-center justify-between gap-4">
            <Label>Theme</Label>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([theme])}
              onSelectionChange={(keys) => {
                const next = [...keys][0]
                if (next) void handleThemeChange(next as ThemePref)
              }}
            >
              <ToggleButton isIconOnly id="light" aria-label="Light">
                <Sun className="size-4" />
              </ToggleButton>
              <ToggleButton isIconOnly id="dark" aria-label="Dark">
                <ToggleButtonGroup.Separator />
                <Moon className="size-4" />
              </ToggleButton>
              <ToggleButton isIconOnly id="system" aria-label="System">
                <ToggleButtonGroup.Separator />
                <Monitor className="size-4" />
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <Label>Language</Label>
            <Select
              aria-label="Language"
              selectedKey={language}
              onSelectionChange={(key) => void handleLanguageChange(String(key))}
              className="w-32"
            >
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SUPPORTED_LANGUAGES.map((code) => (
                    <ListBox.Item key={code} id={code} textValue={LANG_LABEL[code] ?? code}>
                      {LANG_LABEL[code] ?? code}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </FieldGroup>
      </Fieldset>
    </Surface>
  )
}

// ─── Org General section ───────────────────────────────────────────────────────

function OrgGeneralSection({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const queryClient = useQueryClient()

  // ── Identity (name + description) ─────────────────────────────────────────
  const [info, setInfo] = useState<OrgGeneralInfo | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── Root landing publication ───────────────────────────────────────────────
  const [nodeVisibility, setNodeVisibility] = useState<OrgNodeVisibility | null>(null)
  const [rootLandingBusy, setRootLandingBusy] = useState(false)
  const [rootLandingError, setRootLandingError] = useState<string | null>(null)

  // ── Workspace run visibility toggle ───────────────────────────────────────
  const [runVisibility, setRunVisibility] = useState<OrgRunVisibility | null>(null)
  const [runVisBusy, setRunVisBusy] = useState(false)
  const [runVisError, setRunVisError] = useState<string | null>(null)

  useEffect(() => {
    setLoadError(null)
    Promise.all([
      fetchOrgGeneralInfo(orgId),
      fetchRootLandingStatus(orgId),
      fetchOrgRunVisibility(orgId),
    ]).then(([i, nv, rv]) => {
      setInfo(i)
      setName(i?.name ?? '')
      setDescription(i?.description ?? '')
      setNodeVisibility(nv)
      setRunVisibility(rv)
    }).catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
  }, [orgId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const updates: { name?: string; description?: string | null } = {}
      if (name.trim() && name.trim() !== info?.name) updates.name = name.trim()
      const nextDesc = description.trim() || null
      if (nextDesc !== (info?.description ?? null)) updates.description = nextDesc
      if (Object.keys(updates).length > 0) {
        await saveOrgGeneralInfo(orgId, updates as { name?: string; description?: string })
        setInfo((prev) => prev ? { ...prev, ...updates, description: nextDesc } : prev)
        // Invalidate the org list so the rail OrgSwitcher reflects the new name.
        void queryClient.invalidateQueries({ queryKey: ['shell', 'orgs'] })
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRootLandingToggle() {
    if (!nodeVisibility) return
    setRootLandingBusy(true)
    setRootLandingError(null)
    try {
      const next = !nodeVisibility.isRootLanding
      await setRootLanding(orgId, next, next ? undefined : undefined)
      setNodeVisibility((prev) => prev ? { ...prev, isRootLanding: next } : prev)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      // Map known RPC error codes to user-friendly messages.
      if (msg.includes('auth-required')) setRootLandingError('You must be signed in.')
      else if (msg.includes('forbidden')) setRootLandingError('You do not have permission to publish.')
      else if (msg.includes('private-org')) setRootLandingError('Make this organization public before publishing as root landing.')
      else if (msg.includes('duplicate-root')) setRootLandingError('Another organization is already set as root landing.')
      else if (msg.includes('org-not-found')) setRootLandingError('Organization not found.')
      else setRootLandingError(msg)
    } finally {
      setRootLandingBusy(false)
    }
  }

  async function handleRunVisibilityToggle(next: boolean) {
    setRunVisBusy(true)
    setRunVisError(null)
    try {
      await saveOrgRunVisibility(orgId, next)
      setRunVisibility({ workspaceRunVisibility: next })
    } catch (e: unknown) {
      setRunVisError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setRunVisBusy(false)
    }
  }

  if (!info) {
    return (
      <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
        {loadError ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{loadError}</Alert.Description></Alert.Content>
          </Alert>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
        )}
      </Surface>
    )
  }

  const isPublic = nodeVisibility?.visibilityMode === 'public'
  const isRootLanding = nodeVisibility?.isRootLanding ?? false
  const canPublish = canManage && isPublic && !isRootLanding
  const rootLandingStatus = isRootLanding
    ? 'Current root landing'
    : isPublic
      ? 'Ready to publish'
      : 'Make this organization public before publishing'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <Surface variant="default" className="rounded-3xl p-4 sm:p-5">
        <Form onSubmit={handleSubmit}>
          <Fieldset>
            <Fieldset.Legend>General</Fieldset.Legend>
            <Description>Organization identity visible to all members.</Description>
            {saveError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content><Alert.Description>{saveError}</Alert.Description></Alert.Content>
              </Alert>
            )}
            <FieldGroup>
              <TextField name="name" isReadOnly={!canManage} value={name} onChange={canManage ? setName : undefined}>
                <Label>Organization name</Label>
                <Input variant="secondary" />
                <FieldError />
              </TextField>
              <TextField name="description" isReadOnly={!canManage} value={description} onChange={canManage ? setDescription : undefined}>
                <Label>Description</Label>
                <TextArea variant="secondary" rows={3} />
                <FieldError />
              </TextField>
              {info.slug && (
                <TextField name="slug" isReadOnly value={`${info.slug}.bos.pro`}>
                  <Label>Organization URL</Label>
                  <Input variant="secondary" className="font-mono" />
                  <Description>Slug cannot be changed here.</Description>
                </TextField>
              )}
            </FieldGroup>
            {canManage && (
              <Fieldset.Actions>
                <Button
                  type="button"
                  variant="tertiary"
                  isDisabled={saving}
                  onPress={() => { setName(info.name); setDescription(info.description ?? '') }}
                >
                  Cancel
                </Button>
              </Fieldset.Actions>
            )}
          </Fieldset>
        </Form>
      </Surface>

      {/* ── Workspace-wide run visibility ─────────────────────────────────── */}
      <Surface variant="default" className="rounded-3xl p-4 sm:p-5">
        <Fieldset>
          <Fieldset.Legend>Run visibility</Fieldset.Legend>
          <Description>When enabled, workspace members can see runs owned by other members.</Description>
          {runVisError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Description>{runVisError}</Alert.Description></Alert.Content>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-sm font-medium text-foreground">Workspace-wide run visibility</p>
              <p className="text-xs text-muted">Members see all workspace runs, not just their own.</p>
            </div>
            <Switch
              data-testid="org-settings-run-visibility"
              isSelected={runVisibility?.workspaceRunVisibility ?? false}
              isDisabled={!canManage || runVisBusy || runVisibility === null}
              onChange={(checked) => void handleRunVisibilityToggle(checked)}
            />
          </div>
          {!canManage && (
            <p className="mt-2 text-xs text-muted">You need admin or owner rights to change this setting.</p>
          )}
        </Fieldset>
      </Surface>

      {/* ── Root landing publication ──────────────────────────────────────── */}
      <Surface variant="default" className="rounded-3xl p-4 sm:p-5">
        <Fieldset>
          <Fieldset.Legend>Root landing</Fieldset.Legend>
          <Description>Promote this organization as the public bos.pro root landing. Only one organization can hold this role at a time.</Description>
          {rootLandingError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Description>{rootLandingError}</Alert.Description></Alert.Content>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-sm font-medium text-foreground">{rootLandingStatus}</p>
              {!isPublic && (
                <p className="text-xs text-muted">Set visibility to public first.</p>
              )}
            </div>
            {canManage && (
              <Button
                size="sm"
                variant={isRootLanding ? 'secondary' : 'primary'}
                isDisabled={!canPublish || rootLandingBusy}
                onPress={() => void handleRootLandingToggle()}
              >
                {isRootLanding ? 'Demote' : 'Publish as root landing'}
              </Button>
            )}
          </div>
          {!canManage && (
            <p className="mt-2 text-xs text-muted">You need admin or owner rights to publish.</p>
          )}
        </Fieldset>
      </Surface>
    </div>
  )
}

// ─── Org People section ────────────────────────────────────────────────────────

type PeopleTab = 'members' | 'invitations' | 'settings'

const ROLE_HIERARCHY: Record<string, number> = { owner: 0, admin: 1, member: 2, viewer: 3 }
const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const PEOPLE_PAGE_SIZE = 10

function OrgPeopleSection({ orgId, currentUserId, canManage }: { orgId: string; currentUserId: string; canManage: boolean }) {
  // Derive the current user's role from the loaded member list
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isOwner = currentUserRole === 'owner'

  const [tab, setTab] = useState<PeopleTab>('members')
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<OrgInvitation[]>([])
  const [orgWorkspaces, setOrgWorkspaces] = useState<OrgWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Members list controls
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<'name' | 'role' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  // Per-action loading states
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null)

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteWsId, setInviteWsId] = useState('')
  const [inviting, setInviting] = useState(false)

  // Org member settings (default role, self-registration)
  const [defaultRole, setDefaultRole] = useState<string>('member')
  const [allowSelfReg, setAllowSelfReg] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [savingDefaultRole, setSavingDefaultRole] = useState(false)
  const [savingSelfReg, setSavingSelfReg] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [m, inv, ws] = await Promise.all([
        fetchOrgMembers(orgId),
        canManage ? fetchOrgInvitations(orgId) : Promise.resolve([]),
        fetchOrgWorkspaces(orgId),
      ])
      setMembers(m)
      setInvitations(inv)
      setOrgWorkspaces(ws)
      // Determine current user's role from member list
      const self = m.find((mem) => mem.id === currentUserId)
      setCurrentUserRole(self?.role ?? null)
      // Pre-select first workspace for invite modal
      if (ws.length > 0) setInviteWsId((prev) => prev || ws[0].id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function loadSettings() {
    if (!canManage) return
    setSettingsLoading(true)
    setSettingsError(null)
    try {
      const defaults = await fetchOrgDefaultMemberRole(orgId)
      setDefaultRole(defaults.defaultMemberRole)
      setAllowSelfReg(defaults.allowSelfRegistration)
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => { void load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'settings') void loadSettings()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered + sorted + paginated members
  const filteredMembers = useMemo(() => {
    let result = members
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((m) =>
        (m.fullName ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter((m) => (m.role ?? 'member') === roleFilter)
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0
        if (sortField === 'name') {
          cmp = (a.fullName ?? a.email ?? '').localeCompare(b.fullName ?? b.email ?? '')
        } else if (sortField === 'role') {
          cmp = (ROLE_HIERARCHY[a.role ?? 'member'] ?? 99) - (ROLE_HIERARCHY[b.role ?? 'member'] ?? 99)
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      // Default: sort by role hierarchy
      result = [...result].sort((a, b) =>
        (ROLE_HIERARCHY[a.role ?? 'member'] ?? 99) - (ROLE_HIERARCHY[b.role ?? 'member'] ?? 99)
      )
    }
    return result
  }, [members, search, roleFilter, sortField, sortDir])

  const totalPages = Math.ceil(filteredMembers.length / PEOPLE_PAGE_SIZE)
  const pageMembers = filteredMembers.slice(page * PEOPLE_PAGE_SIZE, (page + 1) * PEOPLE_PAGE_SIZE)

  function handleSort(field: 'name' | 'role') {
    if (sortField === field) {
      if (sortDir === 'asc') { setSortDir('desc') }
      else { setSortField(null); setSortDir('asc') }
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(0)
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setActionError(null)
    setPendingRoleChange(userId)
    try {
      await changeOrgMemberRole(orgId, userId, newRole)
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role: newRole } : m))
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Role change failed')
    } finally {
      setPendingRoleChange(null)
    }
  }

  async function handleRemove(userId: string) {
    setActionError(null)
    setPendingRemoveId(userId)
    try {
      await removeOrgMember(orgId, userId)
      setMembers((prev) => prev.filter((m) => m.id !== userId))
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setPendingRemoveId(null)
      setConfirmRemoveId(null)
    }
  }

  async function handleRevoke(invId: string) {
    setActionError(null)
    setPendingRevokeId(invId)
    try {
      await revokeInvitation(invId)
      setInvitations((prev) => prev.filter((i) => i.id !== invId))
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setPendingRevokeId(null)
    }
  }

  async function handleInvite() {
    if (!inviteWsId) {
      setActionError('Please select a workspace')
      return
    }
    setInviting(true)
    setActionError(null)
    try {
      await inviteMember(orgId, inviteEmail.trim(), inviteRole, inviteWsId)
      const inv = await fetchOrgInvitations(orgId)
      setInvitations(inv)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      setInviteWsId(orgWorkspaces[0]?.id ?? '')
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  async function handleSaveDefaultRole(newRole: string) {
    setSavingDefaultRole(true)
    setSettingsError(null)
    try {
      await saveOrgDefaultMemberRole(orgId, newRole)
      setDefaultRole(newRole)
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingDefaultRole(false)
    }
  }

  async function handleToggleSelfReg(enabled: boolean) {
    setSavingSelfReg(true)
    setSettingsError(null)
    try {
      await saveOrgSelfRegistration(orgId, enabled)
      setAllowSelfReg(enabled)
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingSelfReg(false)
    }
  }

  // Roles that can be assigned (owner sees all; admin cannot assign owner)
  function assignableRoles(): string[] {
    if (isOwner) return ['owner', 'admin', 'member', 'viewer']
    if (canManage) return ['admin', 'member', 'viewer']
    return []
  }

  // Can current user manage this member's role/removal?
  function canManageMember(m: OrgMember): boolean {
    if (m.id === currentUserId) return false
    if (!canManage) return false
    if (isOwner) return true
    // admin cannot manage other owners
    if ((m.role ?? 'member') === 'owner') return false
    return true
  }

  const roles = assignableRoles()
  const memberToRemove = confirmRemoveId ? members.find((m) => m.id === confirmRemoveId) : null

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">People</p>
          <p className="text-sm text-muted">Organization members and pending invitations.</p>
        </div>
        {canManage && (
          <Button size="sm" variant="primary" onPress={() => { setActionError(null); setInviteOpen(true) }}>
            Invite member
          </Button>
        )}
      </div>

      {error && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
        </Alert>
      )}
      {actionError && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{actionError}</Alert.Description></Alert.Content>
        </Alert>
      )}

      <Tabs selectedKey={tab} onSelectionChange={(k) => { setTab(k as PeopleTab); setActionError(null) }}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="People">
            <Tabs.Tab id="members">Members<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="invitations">Invitations<Tabs.Indicator /></Tabs.Tab>
            {canManage && <Tabs.Tab id="settings">Settings<Tabs.Indicator /></Tabs.Tab>}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="members">
          {/* Search + filter + sort controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted pointer-events-none" />
              <Input
                variant="secondary"
                className="pl-8 text-sm"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                aria-label="Search members"
              />
            </div>
            <Select
              aria-label="Filter by role"
              selectedKey={roleFilter}
              onSelectionChange={(k) => { setRoleFilter(String(k)); setPage(0) }}
              className="w-32"
            >
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="All roles">All roles<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="owner" textValue="Owner">Owner<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="admin" textValue="Admin">Admin<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="member" textValue="Member">Member<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="viewer" textValue="Viewer">Viewer<ListBox.ItemIndicator /></ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={sortField === 'name' ? 'secondary' : 'ghost'}
                onPress={() => handleSort('name')}
              >
                Name {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </Button>
              <Button
                size="sm"
                variant={sortField === 'role' ? 'secondary' : 'ghost'}
                onPress={() => handleSort('role')}
              >
                Role {sortField === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <Spinner size="sm" /> Loading…
            </div>
          ) : (
            <>
              <Surface variant="secondary" className="mt-3 overflow-hidden rounded-2xl">
                {pageMembers.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    {search || roleFilter !== 'all' ? 'No members match the current filter' : 'No members found'}
                  </p>
                ) : pageMembers.map((m, i) => (
                  <div key={m.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar size="sm">
                        {m.avatarUrl && <Avatar.Image src={m.avatarUrl} alt={m.fullName ?? ''} />}
                        <Avatar.Fallback>{(m.fullName ?? m.email ?? '?')[0]?.toUpperCase()}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.fullName ?? m.email ?? m.id}
                          {m.id === currentUserId && (
                            <span className="ml-1.5 text-xs text-muted font-normal">(you)</span>
                          )}
                        </p>
                        {m.fullName && <p className="truncate text-xs text-muted">{m.email}</p>}
                      </div>
                      {canManageMember(m) ? (
                        <Select
                          aria-label="Role"
                          selectedKey={m.role ?? 'member'}
                          onSelectionChange={(k) => void handleRoleChange(m.id, String(k))}
                          className="w-28"
                          isDisabled={pendingRoleChange === m.id}
                        >
                          <Select.Trigger>
                            {pendingRoleChange === m.id
                              ? <Spinner size="sm" />
                              : <Select.Value />
                            }
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {roles.map((r) => (
                                <ListBox.Item key={r} id={r} textValue={ROLE_LABELS[r] ?? r}>
                                  {ROLE_LABELS[r] ?? r}<ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      ) : (
                        <Chip size="sm" variant="soft">
                          {ROLE_LABELS[m.role ?? 'member'] ?? (m.role ?? 'member')}
                        </Chip>
                      )}
                      {isOwner && m.id !== currentUserId && (m.role ?? 'member') !== 'owner' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          isDisabled={pendingRemoveId === m.id}
                          onPress={() => setConfirmRemoveId(m.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </Surface>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm text-muted">
                  <span>{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      isDisabled={page === 0}
                      onPress={() => setPage((p) => p - 1)}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span>{page + 1} / {totalPages}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      isDisabled={page >= totalPages - 1}
                      onPress={() => setPage((p) => p + 1)}
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="invitations">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <Spinner size="sm" /> Loading…
            </div>
          ) : (
            <Surface variant="secondary" className="mt-3 overflow-hidden rounded-2xl">
              {invitations.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No pending invitations</p>
              ) : invitations.map((inv, i) => (
                <div key={inv.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.invitedEmail}</p>
                      <p className="text-xs text-muted">
                        {inv.workspaceName ?? inv.workspaceId} · {ROLE_LABELS[inv.role] ?? inv.role}
                      </p>
                    </div>
                    <Chip size="sm" variant="soft" color="warning">pending</Chip>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        isDisabled={pendingRevokeId === inv.id}
                        onPress={() => void handleRevoke(inv.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Surface>
          )}
        </Tabs.Panel>

        {canManage && (
          <Tabs.Panel id="settings">
            {settingsLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted">
                <Spinner size="sm" /> Loading…
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {settingsError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content><Alert.Description>{settingsError}</Alert.Description></Alert.Content>
                  </Alert>
                )}
                <Surface variant="secondary" className="overflow-hidden rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Default member role</p>
                      <p className="text-xs text-muted">Role assigned to newly joined members.</p>
                    </div>
                    <Select
                      aria-label="Default member role"
                      selectedKey={defaultRole}
                      onSelectionChange={(k) => void handleSaveDefaultRole(String(k))}
                      className="w-32"
                      isDisabled={savingDefaultRole}
                    >
                      <Select.Trigger>
                        {savingDefaultRole ? <Spinner size="sm" /> : <Select.Value />}
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="admin" textValue="Admin">Admin<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="member" textValue="Member">Member<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="viewer" textValue="Viewer">Viewer<ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </Surface>
                <Surface variant="secondary" className="overflow-hidden rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Allow self-registration</p>
                      <p className="text-xs text-muted">Let anyone with your org link join without an invitation.</p>
                    </div>
                    <Switch
                      isSelected={allowSelfReg}
                      onChange={(checked) => void handleToggleSelfReg(checked)}
                      isDisabled={savingSelfReg}
                      aria-label="Allow self-registration"
                    />
                  </div>
                </Surface>
              </div>
            )}
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Invite member modal — with workspace picker */}
      <Modal.Backdrop isOpen={inviteOpen} onOpenChange={(o) => { if (!o) { setInviteOpen(false); setActionError(null) } }}>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>Invite member</Modal.Heading></Modal.Header>
            <Modal.Body>
              <Form id="invite-form" onSubmit={(e) => { e.preventDefault(); void handleInvite() }}>
                <FieldGroup>
                  <TextField name="email" type="email" value={inviteEmail} onChange={setInviteEmail} isRequired>
                    <Label>Email address</Label>
                    <Input variant="secondary" placeholder="jane@example.com" />
                    <FieldError />
                  </TextField>
                  <div>
                    <Label>Role</Label>
                    <Select
                      aria-label="Role"
                      selectedKey={inviteRole}
                      onSelectionChange={(k) => setInviteRole(String(k))}
                      className="mt-1 w-full"
                    >
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="member" textValue="Member">Member<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="admin" textValue="Admin">Admin<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="viewer" textValue="Viewer">Viewer<ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  {orgWorkspaces.length > 0 && (
                    <div>
                      <Label>Workspace</Label>
                      <Select
                        aria-label="Workspace"
                        selectedKey={inviteWsId}
                        onSelectionChange={(k) => setInviteWsId(String(k))}
                        className="mt-1 w-full"
                      >
                        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {orgWorkspaces.map((ws) => (
                              <ListBox.Item key={ws.id} id={ws.id} textValue={ws.name}>
                                {ws.name}<ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <Description>The member will receive access to this workspace.</Description>
                    </div>
                  )}
                </FieldGroup>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => { setInviteOpen(false); setActionError(null) }}>Cancel</Button>
              <Button
                variant="primary"
                form="invite-form"
                type="submit"
                isDisabled={inviting || !inviteWsId}
              >
                Send invite
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Confirm remove dialog */}
      <Modal.Backdrop isOpen={!!confirmRemoveId} onOpenChange={(o) => { if (!o) setConfirmRemoveId(null) }}>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>Remove member</Modal.Heading></Modal.Header>
            <Modal.Body>
              <p className="text-sm">
                Remove{'  '}
                <span className="font-medium">
                  {memberToRemove?.fullName ?? memberToRemove?.email ?? confirmRemoveId}
                </span>
                {' '}from the organization? This cannot be undone.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setConfirmRemoveId(null)}>Cancel</Button>
              <Button
                variant="danger"
                isDisabled={pendingRemoveId === confirmRemoveId}
                onPress={() => { if (confirmRemoveId) void handleRemove(confirmRemoveId) }}
              >
                Remove
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Surface>
  )
}

// ─── Workspace General section ─────────────────────────────────────────────────

function WsGeneralSection({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const [info, setInfo] = useState<WsGeneralInfo | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWsGeneralInfo(workspaceId).then((i) => {
      setInfo(i)
      setName(i?.name ?? '')
      setDescription(i?.description ?? '')
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [workspaceId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updates: { name?: string; description?: string } = {}
      if (name.trim() && name.trim() !== info?.name) updates.name = name.trim()
      if (description !== (info?.description ?? '')) updates.description = description
      await saveWsGeneralInfo(workspaceId, updates)
      setInfo((prev) => prev ? { ...prev, ...updates } : prev)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!info) {
    return (
      <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
      </Surface>
    )
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>General</Fieldset.Legend>
          <Description>Workspace name and description.</Description>
          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
            </Alert>
          )}
          <FieldGroup>
            <TextField name="name" isReadOnly={!canManage} value={name} onChange={canManage ? setName : undefined}>
              <Label>Workspace name</Label>
              <Input variant="secondary" />
              <FieldError />
            </TextField>
            <TextField name="description" isReadOnly={!canManage} value={description} onChange={canManage ? setDescription : undefined}>
              <Label>Description</Label>
              <TextArea variant="secondary" rows={3} />
              <FieldError />
            </TextField>
          </FieldGroup>
          {canManage && (
            <Fieldset.Actions>
              <Button
                type="button"
                variant="tertiary"
                isDisabled={saving}
                onPress={() => { setName(info.name); setDescription(info.description ?? '') }}
              >
                Cancel
              </Button>
            </Fieldset.Actions>
          )}
        </Fieldset>
      </Form>
    </Surface>
  )
}

// ─── Workspace Members section ─────────────────────────────────────────────────

function WsMembersSection({ workspaceId, currentUserId: _uid, canManage: _cm }: { workspaceId: string; currentUserId: string; canManage: boolean }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchWorkspaceMembers(workspaceId)
      .then(setMembers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [workspaceId])

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Members</Fieldset.Legend>
        <Description>Members with direct access to this workspace.</Description>
        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
        ) : (
          <Surface variant="secondary" className="overflow-hidden rounded-2xl">
            {members.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No direct workspace members</p>
            ) : members.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Avatar size="sm">
                    {m.avatarUrl && <Avatar.Image src={m.avatarUrl} alt={m.fullName ?? ''} />}
                    <Avatar.Fallback>{(m.fullName ?? m.email ?? '?')[0]?.toUpperCase()}</Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.fullName ?? m.email ?? m.id}</p>
                    {m.fullName && <p className="truncate text-xs text-muted">{m.email}</p>}
                  </div>
                  <Chip size="sm" variant="soft">{m.role ?? 'member'}</Chip>
                </div>
              </div>
            ))}
          </Surface>
        )}
      </Fieldset>
    </Surface>
  )
}

// ─── Notifications section ─────────────────────────────────────────────────────

type NotificationMode = 'members' | 'mentions' | 'off'

const NOTIFICATION_MODES: Array<{ id: NotificationMode; label: string; description: string }> = [
  { id: 'members', label: 'All activity', description: 'Notify me about all workspace activity' },
  { id: 'mentions', label: 'Mentions only', description: 'Only notify when I am mentioned' },
  { id: 'off', label: 'Off', description: 'No in-app notifications' },
]

function NotificationsSection({ userId }: { userId: string }) {
  const [notifMode, setNotifMode] = useState<NotificationMode>('members')
  const [loadingNotif, setLoadingNotif] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingNotif(true)
    fetchUserPreferences(userId)
      .then((prefs) => {
        const raw = prefs?.notificationMode
        if (raw === 'members' || raw === 'mentions' || raw === 'off') setNotifMode(raw)
      })
      .catch((e: unknown) => setNotifError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoadingNotif(false))
  }, [userId])

  async function handleModeChange(next: NotificationMode) {
    if (next === notifMode) return
    setSavingNotif(true)
    setNotifError(null)
    const prev = notifMode
    setNotifMode(next)
    try {
      await updateUserPreference(userId, 'notificationMode', next)
    } catch (e: unknown) {
      setNotifMode(prev)
      setNotifError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingNotif(false)
    }
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Notifications</Fieldset.Legend>
        <Description>Control how and when you receive in-app notifications.</Description>
        {notifError && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{notifError}</Alert.Description></Alert.Content>
          </Alert>
        )}
        {loadingNotif ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
        ) : (
          <FieldGroup>
            <div>
              <Label className="mb-2 block">In-app notification mode</Label>
              <Surface variant="secondary" className="overflow-hidden rounded-2xl">
                {NOTIFICATION_MODES.map((opt, i) => (
                  <div key={opt.id}>
                    {i > 0 && <Separator />}
                    <button
                      type="button"
                      disabled={savingNotif}
                      onClick={() => void handleModeChange(opt.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-overlay/50 disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted">{opt.description}</p>
                      </div>
                      {notifMode === opt.id && (
                        <Chip size="sm" variant="soft" color="accent">Active</Chip>
                      )}
                    </button>
                  </div>
                ))}
              </Surface>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl px-1 py-1">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted">Receive a daily digest by email</p>
              </div>
              <Chip size="sm" variant="soft">Planned</Chip>
            </div>
          </FieldGroup>
        )}
      </Fieldset>
    </Surface>
  )
}

// ─── Security section ──────────────────────────────────────────────────────────

function SecuritySection() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }
    setSavingPw(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword })
      if (authErr) throw new Error(authErr.message)
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Password change failed')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Security</Fieldset.Legend>
        <Description>Manage your account security settings.</Description>

        {pwError && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{pwError}</Alert.Description></Alert.Content>
          </Alert>
        )}
        {pwSuccess && (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>Password updated successfully.</Alert.Description></Alert.Content>
          </Alert>
        )}

        <Form onSubmit={handlePasswordChange}>
          <p className="mt-3 mb-1 flex items-center gap-1.5 text-sm font-medium">
            <Lock className="size-4" />
            Change password
          </p>
          <FieldGroup>
            <TextField name="newPassword" type="password" value={newPassword} onChange={setNewPassword} isRequired>
              <Label>New password</Label>
              <Input variant="secondary" placeholder="At least 8 characters" autoComplete="new-password" />
              <FieldError />
            </TextField>
            <TextField name="confirmPassword" type="password" value={confirmPassword} onChange={setConfirmPassword} isRequired>
              <Label>Confirm new password</Label>
              <Input variant="secondary" placeholder="Repeat new password" autoComplete="new-password" />
              <FieldError />
            </TextField>
          </FieldGroup>
          <Fieldset.Actions>
            <Button type="submit" isDisabled={savingPw || !newPassword || !confirmPassword}>
              Update password
            </Button>
          </Fieldset.Actions>
        </Form>

        <Separator className="my-4" />

        <Surface variant="secondary" className="overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield className="size-4 text-muted" />
              <div>
                <p className="text-sm font-medium">Two-factor authentication</p>
                <p className="text-xs text-muted">Add an extra layer of security to your account</p>
              </div>
            </div>
            <Chip size="sm" variant="soft">Coming soon</Chip>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Monitor className="size-4 text-muted" />
              <div>
                <p className="text-sm font-medium">Active sessions</p>
                <p className="text-xs text-muted">Manage devices signed into your account</p>
              </div>
            </div>
            <Chip size="sm" variant="soft">Coming soon</Chip>
          </div>
        </Surface>
      </Fieldset>
    </Surface>
  )
}

// ─── Org Credentials section ───────────────────────────────────────────────────

const EMPTY_CREDS = {
  anthropic_api_key: '',
  openai_api_key: '',
  gemini_api_key: '',
  xai_api_key: '',
  openrouter_api_key: '',
  github_token: '',
  supabase_pat_token: '',
}

function OrgCredentialsSection({ orgId, canManage, userId }: { orgId: string; canManage: boolean; userId: string }) {
  const [status, setStatus] = useState<OrgCredentialStatus>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState(EMPTY_CREDS)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [healthVerdicts, setHealthVerdicts] = useState<Record<string, 'healthy' | 'dead'>>({})
  const [isPlatformDefault, setIsPlatformDefault] = useState(false)
  // Anthropic OAuth
  const [anthropicOAuthUrl, setAnthropicOAuthUrl] = useState<string | null>(null)
  const [anthropicOAuthCode, setAnthropicOAuthCode] = useState('')
  const [anthropicOAuthState, setAnthropicOAuthState] = useState('')
  const [anthropicOAuthLoading, setAnthropicOAuthLoading] = useState(false)
  const [anthropicOAuthError, setAnthropicOAuthError] = useState<string | null>(null)
  // OpenAI OAuth
  const [openaiOAuthUrl, setOpenaiOAuthUrl] = useState<string | null>(null)
  const [openaiOAuthCode, setOpenaiOAuthCode] = useState('')
  const [openaiOAuthState, setOpenaiOAuthState] = useState('')
  const [openaiOAuthLoading, setOpenaiOAuthLoading] = useState(false)
  const [openaiOAuthError, setOpenaiOAuthError] = useState<string | null>(null)
  // Enterprise CTA
  const [enterpriseSubmitting, setEnterpriseSubmitting] = useState(false)
  const [enterpriseSuccess, setEnterpriseSuccess] = useState(false)
  const [enterpriseError, setEnterpriseError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [st, orgRes] = await Promise.all([
        fetchOrgCredentialStatus(orgId),
        supabase.from('organizations').select('is_platform_default').eq('id', orgId).maybeSingle(),
      ])
      setStatus(st)
      const orgRow = orgRes.data as { is_platform_default: boolean } | null
      setIsPlatformDefault(Boolean(orgRow?.is_platform_default))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  const loadHealth = useCallback(async () => {
    try {
      const res = await runnerFetch(`/org/${orgId}/credentials/health`)
      if (!res.ok) return
      const payload = await res.json().catch(() => null) as { verdicts?: Array<{ provider: string; verdict: string }> } | null
      if (!payload?.verdicts) return
      const map: Record<string, 'healthy' | 'dead'> = {}
      for (const item of payload.verdicts) {
        if (item.verdict === 'healthy' || item.verdict === 'dead') map[item.provider] = item.verdict
      }
      setHealthVerdicts(map)
    } catch { /* fail-open */ }
  }, [orgId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setHealthVerdicts({}); void loadHealth() }, [loadHealth])

  async function handleSave() {
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const providerPatch: Record<string, string> = {}
      if (creds.anthropic_api_key.trim()) providerPatch.anthropic_api_key = creds.anthropic_api_key.trim()
      if (creds.openai_api_key.trim()) providerPatch.openai_api_key = creds.openai_api_key.trim()
      if (creds.gemini_api_key.trim()) providerPatch.gemini_api_key = creds.gemini_api_key.trim()
      if (creds.xai_api_key.trim()) providerPatch.xai_api_key = creds.xai_api_key.trim()
      if (creds.openrouter_api_key.trim()) providerPatch.openrouter_api_key = creds.openrouter_api_key.trim()
      const githubPatch = creds.github_token.trim() ? { github_token: creds.github_token.trim() } : {}
      const supabasePatch = creds.supabase_pat_token.trim() ? { supabase_pat_token: creds.supabase_pat_token.trim() } : {}
      if (!Object.keys(providerPatch).length && !Object.keys(githubPatch).length && !Object.keys(supabasePatch).length) {
        setSaveError('Enter at least one credential to update')
        return
      }
      await updateOrgCredentialsPartial(orgId, providerPatch, githubPatch as Record<string, string>, supabasePatch as Record<string, string>)
      setCreds(EMPTY_CREDS)
      setSaveSuccess(true)
      await load()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAnthropicOAuthStart() {
    if (!canManage) return
    setAnthropicOAuthLoading(true)
    setAnthropicOAuthError(null)
    try {
      const res = await runnerFetch(`/org/${orgId}/auth-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'anthropic' }),
      })
      const payload = await res.json().catch(() => ({})) as { mode?: string; url?: string; state?: string; error?: string }
      if (!res.ok) throw new Error(payload.error ?? 'Failed to get auth link')
      if (payload.mode === 'oauth_code' && payload.url) {
        window.open(payload.url, '_blank')
        setAnthropicOAuthUrl(payload.url)
        if (typeof payload.state === 'string') setAnthropicOAuthState(payload.state)
        return
      }
      throw new Error('No auth link returned')
    } catch (e: unknown) {
      setAnthropicOAuthError(e instanceof Error ? e.message : 'Failed to start browser auth')
    } finally {
      setAnthropicOAuthLoading(false)
    }
  }

  async function handleAnthropicOAuthComplete() {
    if (!canManage || !anthropicOAuthCode.trim()) return
    setAnthropicOAuthLoading(true)
    setAnthropicOAuthError(null)
    try {
      const res = await runnerFetch(`/org/${orgId}/auth-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'anthropic', code: anthropicOAuthCode.trim(), state: anthropicOAuthState }),
      })
      const payload = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? 'Failed to complete OAuth')
      setAnthropicOAuthUrl(null)
      setAnthropicOAuthCode('')
      setAnthropicOAuthState('')
      await load()
    } catch (e: unknown) {
      setAnthropicOAuthError(e instanceof Error ? e.message : 'Failed to complete Anthropic OAuth')
    } finally {
      setAnthropicOAuthLoading(false)
    }
  }

  async function handleOpenAIOAuthStart() {
    if (!canManage) return
    setOpenaiOAuthLoading(true)
    setOpenaiOAuthError(null)
    try {
      const res = await runnerFetch(`/org/${orgId}/auth-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai' }),
      })
      const payload = await res.json().catch(() => ({})) as { mode?: string; url?: string; state?: string; autoCallback?: boolean; error?: string }
      if (!res.ok) throw new Error(payload.error ?? 'Failed to get auth link')
      if (payload.mode === 'oauth_code' && payload.url) {
        if (payload.autoCallback) { window.location.href = payload.url; return }
        window.open(payload.url, '_blank')
        setOpenaiOAuthUrl(payload.url)
        if (typeof payload.state === 'string') setOpenaiOAuthState(payload.state)
        return
      }
      throw new Error('No auth link returned')
    } catch (e: unknown) {
      setOpenaiOAuthError(e instanceof Error ? e.message : 'Failed to start OpenAI browser auth')
    } finally {
      setOpenaiOAuthLoading(false)
    }
  }

  async function handleOpenAIOAuthComplete() {
    if (!canManage || !openaiOAuthCode.trim()) return
    setOpenaiOAuthLoading(true)
    setOpenaiOAuthError(null)
    try {
      const res = await runnerFetch(`/org/${orgId}/auth-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', code: openaiOAuthCode.trim(), state: openaiOAuthState }),
      })
      const payload = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? 'Failed to complete OAuth')
      setOpenaiOAuthUrl(null)
      setOpenaiOAuthCode('')
      setOpenaiOAuthState('')
      await load()
    } catch (e: unknown) {
      setOpenaiOAuthError(e instanceof Error ? e.message : 'Failed to complete OpenAI OAuth')
    } finally {
      setOpenaiOAuthLoading(false)
    }
  }

  async function handleEnterpriseContact() {
    setEnterpriseSubmitting(true)
    setEnterpriseError(null)
    try {
      const { error: insErr } = await supabase.from('support_cases').insert({
        org_id: orgId,
        user_id: userId,
        source_surface: 'settings.credentials',
        intent: 'enterprise_contact',
        reason: 'Enterprise credential management interest from Settings > Credentials.',
      } as never)
      if (insErr) throw new Error(insErr.message)
      setEnterpriseSuccess(true)
    } catch (e: unknown) {
      setEnterpriseError(e instanceof Error ? e.message : 'Failed to submit Enterprise request')
    } finally {
      setEnterpriseSubmitting(false)
    }
  }

  function ProviderStatusChip({ hasKey, hasOAuth, verdict }: { hasKey?: boolean; hasOAuth?: boolean; verdict?: 'healthy' | 'dead' }) {
    if (!hasKey && !hasOAuth) return <Chip size="sm" variant="soft" className="text-muted">Not connected</Chip>
    return (
      <Chip size="sm" color={verdict === 'dead' ? 'danger' : 'success'} variant="soft">
        <Check className="size-3 mr-1 inline" />
        {hasOAuth && !hasKey ? 'OAuth' : 'Connected'}
        {verdict === 'dead' ? ' (unhealthy)' : ''}
      </Chip>
    )
  }

  if (loading) {
    return (
      <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading credentials…</div>
      </Surface>
    )
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Credentials</Fieldset.Legend>
        <Description>
          {isPlatformDefault
            ? 'Platform default credentials — shared with all users without personal API keys.'
            : 'Organization-wide API keys used by shared workspace projects.'}
        </Description>

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}

        {isPlatformDefault && (
          <Alert status="success">
            <Alert.Indicator><Shield className="size-4" /></Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Platform Admin Organization</Alert.Title>
              <Alert.Description>API keys here are shared with all users without their own keys. Changes take effect on next session creation.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <FieldGroup>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">AI Providers</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Anthropic (Claude)</Label>
                  <ProviderStatusChip hasKey={status.hasAnthropicApiKey} hasOAuth={status.hasAnthropicOAuth} verdict={healthVerdicts.anthropic} />
                </div>
                <TextField name="anthropic_api_key" type="password" value={creds.anthropic_api_key} onChange={(v) => setCreds((p) => ({ ...p, anthropic_api_key: v }))} isDisabled={!canManage}>
                  <Input variant="secondary" placeholder="sk-ant-api03-…" />
                </TextField>
                <div className="flex items-center justify-between">
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">Get your key <ExternalLink className="size-3" /></a>
                  {!anthropicOAuthUrl && (
                    <Button size="sm" variant="ghost" isDisabled={!canManage || anthropicOAuthLoading} onPress={() => void handleAnthropicOAuthStart()}>
                      <ExternalLink className="size-3" /> Login with Browser
                    </Button>
                  )}
                </div>
                {anthropicOAuthError && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{anthropicOAuthError}</Alert.Description></Alert.Content></Alert>}
                {anthropicOAuthUrl && (
                  <Surface variant="secondary" className="space-y-2 rounded-2xl p-3">
                    <p className="text-xs text-muted">After authorizing with Anthropic, copy the authorization code and paste it below.</p>
                    <TextField name="anthropic_oauth_code" value={anthropicOAuthCode} onChange={setAnthropicOAuthCode} isDisabled={anthropicOAuthLoading}>
                      <Input variant="secondary" placeholder="Paste authorization code" />
                    </TextField>
                    <Button variant="primary" isDisabled={anthropicOAuthLoading || !anthropicOAuthCode.trim()} onPress={() => void handleAnthropicOAuthComplete()} className="w-full">
                      Complete Authorization
                    </Button>
                  </Surface>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>OpenAI (GPT)</Label>
                  <ProviderStatusChip hasKey={status.hasOpenAIApiKey} hasOAuth={status.hasOpenAIOAuth} verdict={healthVerdicts.openai} />
                </div>
                <TextField name="openai_api_key" type="password" value={creds.openai_api_key} onChange={(v) => setCreds((p) => ({ ...p, openai_api_key: v }))} isDisabled={!canManage}>
                  <Input variant="secondary" placeholder="sk-proj-…" />
                </TextField>
                <div className="flex items-center justify-between">
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">Get your key <ExternalLink className="size-3" /></a>
                  {!openaiOAuthUrl && (
                    <Button size="sm" variant="ghost" isDisabled={!canManage || openaiOAuthLoading} onPress={() => void handleOpenAIOAuthStart()}>
                      <ExternalLink className="size-3" /> Login with Browser
                    </Button>
                  )}
                </div>
                {openaiOAuthError && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{openaiOAuthError}</Alert.Description></Alert.Content></Alert>}
                {openaiOAuthUrl && (
                  <Surface variant="secondary" className="space-y-2 rounded-2xl p-3">
                    <p className="text-xs text-muted">After authorizing with OpenAI, if redirected to localhost:1455 paste the full callback URL below.</p>
                    <TextField name="openai_oauth_code" value={openaiOAuthCode} onChange={setOpenaiOAuthCode} isDisabled={openaiOAuthLoading}>
                      <Input variant="secondary" placeholder="Paste callback URL (http://localhost:1455/auth/callback?code=…)" />
                    </TextField>
                    <Button variant="primary" isDisabled={openaiOAuthLoading || !openaiOAuthCode.trim()} onPress={() => void handleOpenAIOAuthComplete()} className="w-full">
                      Complete Authorization
                    </Button>
                  </Surface>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Gemini (Google)</Label>
                  <ProviderStatusChip hasKey={status.hasGeminiApiKey} verdict={healthVerdicts.gemini} />
                </div>
                <TextField name="gemini_api_key" type="password" value={creds.gemini_api_key} onChange={(v) => setCreds((p) => ({ ...p, gemini_api_key: v }))} isDisabled={!canManage}>
                  <Input variant="secondary" placeholder="AIza…" />
                </TextField>
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">Get your key <ExternalLink className="size-3" /></a>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>xAI (Grok)</Label>
                  <ProviderStatusChip hasKey={status.hasXaiApiKey} verdict={healthVerdicts.xai} />
                </div>
                <TextField name="xai_api_key" type="password" value={creds.xai_api_key} onChange={(v) => setCreds((p) => ({ ...p, xai_api_key: v }))} isDisabled={!canManage}>
                  <Input variant="secondary" placeholder="xai-…" />
                </TextField>
                <a href="https://x.ai/api" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">Get your key <ExternalLink className="size-3" /></a>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>OpenRouter</Label>
                  <ProviderStatusChip hasKey={status.hasOpenRouterApiKey} verdict={healthVerdicts.openrouter} />
                </div>
                <TextField name="openrouter_api_key" type="password" value={creds.openrouter_api_key} onChange={(v) => setCreds((p) => ({ ...p, openrouter_api_key: v }))} isDisabled={!canManage}>
                  <Input variant="secondary" placeholder="sk-or-v1-…" />
                </TextField>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">Get your key <ExternalLink className="size-3" /></a>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Git</p>
            <TextField name="github_token" type="password" value={creds.github_token} onChange={(v) => setCreds((p) => ({ ...p, github_token: v }))} isDisabled={!canManage}>
              <Label>GitHub Token</Label>
              <Input variant="secondary" placeholder="ghp_…" />
            </TextField>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Supabase</p>
              <ProviderStatusChip hasKey={status.hasSupabasePatToken} />
            </div>
            <TextField name="supabase_pat_token" type="password" value={creds.supabase_pat_token} onChange={(v) => setCreds((p) => ({ ...p, supabase_pat_token: v }))} isDisabled={!canManage}>
              <Label>PAT Token</Label>
              <Input variant="secondary" placeholder="sbp_…" />
              <Description>Personal Access Token for Supabase Management API. <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get your PAT</a></Description>
            </TextField>
          </div>
        </FieldGroup>

        {saveError && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{saveError}</Alert.Description></Alert.Content>
          </Alert>
        )}
        {saveSuccess && (
          <Alert status="success">
            <Alert.Indicator><Check className="size-4" /></Alert.Indicator>
            <Alert.Content><Alert.Description>Credentials saved successfully.</Alert.Description></Alert.Content>
          </Alert>
        )}

        {canManage && (
          <Fieldset.Actions>
            <Button variant="primary" isDisabled={saving} onPress={() => void handleSave()}>
              Save credentials
            </Button>
            <Button variant="tertiary" isDisabled={saving} onPress={() => { setCreds(EMPTY_CREDS); setSaveError(null); setSaveSuccess(false) }}>
              Clear
            </Button>
          </Fieldset.Actions>
        )}

        <Separator />

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="size-4 shrink-0 text-muted" />
            {enterpriseSuccess ? (
              <p className="text-sm truncate" style={{ color: 'var(--color-success)' }}>Request received — our team will be in touch shortly.</p>
            ) : (
              <p className="text-sm truncate">Need enterprise-grade credential management?</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enterpriseError && <p className="text-xs text-danger">{enterpriseError}</p>}
            <Button
              size="sm"
              variant="secondary"
              isDisabled={enterpriseSubmitting || enterpriseSuccess}
              onPress={() => void handleEnterpriseContact()}
            >
              {enterpriseSuccess ? <><Check className="size-3 mr-1" />Sent</> : 'Contact Enterprise'}
            </Button>
          </div>
        </div>
      </Fieldset>
    </Surface>
  )
}

// ─── Deferred sections ─────────────────────────────────────────────────────────

function DeferredSection({ title }: { title: string }) {
  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>{title}</Fieldset.Legend>
        <Description>{title} — coming soon</Description>
      </Fieldset>
    </Surface>
  )
}

// ─── Account section ───────────────────────────────────────────────────────────

function AccountSection() {
  const { user } = useCurrentUser()
  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <Fieldset>
        <Fieldset.Legend>Account</Fieldset.Legend>
        {user?.email && (
          <FieldGroup>
            <TextField name="email" isReadOnly value={user.email}>
              <Label>Email</Label>
              <Input variant="secondary" />
            </TextField>
          </FieldGroup>
        )}
        <Fieldset.Actions>
          <Button variant="danger" onPress={() => void signOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </Fieldset.Actions>
      </Fieldset>
    </Surface>
  )
}

// ─── Main SettingsPage ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentOrg } = useActiveOrg()
  const { user } = useCurrentUser()

  const section = resolveSection(location.pathname, location.search)
  const orgId = currentOrg?.id ?? null
  const orgRole = currentOrg?.role ?? null
  const canManageOrg = orgRole === 'owner' || orgRole === 'admin'
  const userId = user?.id ?? null

  useEffect(() => {
    if (location.pathname === '/settings') {
      navigate('/settings/profile', { replace: true })
    }
  }, [location.pathname, navigate])

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [wsOptions, setWsOptions] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    if (!orgId) return
    fetchOrgWorkspaces(orgId).then((ws) => {
      setWsOptions(ws)
      if (ws.length > 0 && !workspaceId) setWorkspaceId(ws[0].id)
    }).catch(() => null)
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Sign in to access settings.
      </div>
    )
  }

  const wsSelector = wsOptions.length > 1 ? (
    <div className="mx-auto mb-4 w-full max-w-2xl">
      <Select
        aria-label="Workspace"
        selectedKey={workspaceId ?? ''}
        onSelectionChange={(k) => setWorkspaceId(String(k))}
      >
        <Label>Workspace</Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {wsOptions.map((w) => (
              <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                {w.name}<ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  ) : null

  return (
    <ScrollShadow className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6">
        {section === 'profile' && <ProfileSection userId={userId} />}
        {section === 'appearance' && <AppearanceSection userId={userId} />}
        {section === 'notifications' && <NotificationsSection userId={userId} />}
        {section === 'security' && <SecuritySection />}
        {section === 'connectors' && <DeferredSection title="Personal Connectors" />}
        {section === 'account' && <AccountSection />}

        {section === 'general' && orgId && <OrgGeneralSection orgId={orgId} canManage={canManageOrg} />}
        {section === 'people' && orgId && userId && <OrgPeopleSection orgId={orgId} currentUserId={userId} canManage={canManageOrg} />}
        {section === 'workspaces' && canManageOrg && <DeferredSection title="Workspaces" />}
        {section === 'credentials' && canManageOrg && orgId && userId && <OrgCredentialsSection orgId={orgId} canManage={canManageOrg} userId={userId} />}
        {section === 'knowledge' && canManageOrg && orgId && <OrgKnowledgeSection orgId={orgId} canManage={canManageOrg} />}
        {(section === 'billing' || section === 'usage') && canManageOrg && orgId && <BillingSection orgId={orgId} />}

        {section === 'ws-general' && workspaceId && (
          <>{wsSelector}<WsGeneralSection workspaceId={workspaceId} canManage={canManageOrg} /></>
        )}
        {section === 'ws-members' && workspaceId && userId && (
          <>{wsSelector}<WsMembersSection workspaceId={workspaceId} currentUserId={userId} canManage={canManageOrg} /></>
        )}

        {!section && <AccountSection />}
      </div>
    </ScrollShadow>
  )
}
