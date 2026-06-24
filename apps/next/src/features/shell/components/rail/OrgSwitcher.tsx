import { useState } from 'react'
import {
  Avatar,
  Button,
  Chip,
  Description,
  Disclosure,
  DisclosureGroup,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Popover,
  ScrollShadow,
  Separator,
  Skeleton,
  Spinner,
  TextField,
  Tooltip,
} from '@heroui/react'
import type { Key } from '@heroui/react'
import { Check, Coins, FolderOpen, Plus, Settings, Users } from 'lucide-react'
import { useShellStrings } from '../../i18n'
import type { OrgSwitcherProps } from '../../types'

const MANAGE_ROLES = new Set(['owner', 'admin'])
const ACTION_PREFIX = {
  newWs: 'action::new-ws::',
  settings: 'action::settings::',
  people: 'action::people::',
  billing: 'action::billing::',
} as const

// Action keys encoded into ListBox item ids (workspace items use the raw workspace id). The
// `action::` namespace keeps them from colliding with workspace UUIDs.
const A = {
  newWs: (orgId: string) => `${ACTION_PREFIX.newWs}${orgId}`,
  settings: (orgId: string) => `${ACTION_PREFIX.settings}${orgId}`,
  people: (orgId: string) => `${ACTION_PREFIX.people}${orgId}`,
  billing: (orgId: string) => `${ACTION_PREFIX.billing}${orgId}`,
}

type FormState = { kind: 'workspace'; orgId: string } | { kind: 'org' } | null

// Org/workspace switcher (top of the rail) — the surface the rail avatar opens. Native HeroUI v3
// composition (Constitution IX, no custom CSS): a Popover holding a DisclosureGroup of collapsible
// orgs; each Disclosure body is a ListBox of that org's workspaces + admin actions. Selecting a
// workspace switches scope; a create action reveals an inline Form.
export function OrgSwitcher({
  orgs = [],
  workspaces = [],
  currentOrg,
  currentWorkspaceId,
  loading,
  disabled,
  canManage,
  onSwitchWorkspace,
  onCreateWorkspace,
  onCreateOrganization,
  onOpenOrgSettings,
  onOpenPeople,
  onOpenBilling,
}: OrgSwitcherProps) {
  const t = useShellStrings()
  const [form, setForm] = useState<FormState>(null)

  if (loading || disabled) {
    return <Skeleton className="size-9 rounded-large" aria-label={t.rail.org.loading} />
  }

  const initial = (currentOrg?.name ?? '?').charAt(0).toUpperCase()
  const avatar = (
    <Avatar size="sm">
      <Avatar.Fallback>{initial}</Avatar.Fallback>
    </Avatar>
  )

  // No org at all: a plain, non-clickable label (nothing to switch into).
  if (orgs.length === 0) {
    return (
      <Tooltip delay={300}>
        <span className="flex justify-center" aria-label={t.rail.org.label}>
          {avatar}
        </span>
        <Tooltip.Content placement="right">{t.rail.org.label}</Tooltip.Content>
      </Tooltip>
    )
  }

  function handleAction(key: Key) {
    const id = String(key)
    if (id.startsWith(ACTION_PREFIX.newWs)) {
      return setForm({ kind: 'workspace', orgId: id.slice(ACTION_PREFIX.newWs.length) })
    }
    if (id.startsWith(ACTION_PREFIX.settings)) return onOpenOrgSettings()
    if (id.startsWith(ACTION_PREFIX.people)) return onOpenPeople()
    if (id.startsWith(ACTION_PREFIX.billing)) return onOpenBilling()
    const ws = workspaces.find((w) => w.id === id)
    if (ws) onSwitchWorkspace(ws.organizationId ?? '', ws.id)
  }

  return (
    <Popover>
      <Popover.Trigger aria-label={t.rail.org.switch}>
        <Button isIconOnly variant="ghost" size="md">
          {avatar}
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-72" placement="right top">
        <Popover.Dialog className="p-2">
          {form ? (
            <CreateForm
              t={t}
              form={form}
              onCancel={() => setForm(null)}
              onCreateWorkspace={onCreateWorkspace}
              onCreateOrganization={onCreateOrganization}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <DisclosureGroup
                className="flex flex-col gap-1"
                defaultExpandedKeys={currentOrg ? [currentOrg.id] : []}
              >
                {orgs.map((org) => {
                  const owned = workspaces.filter((w) => w.organizationId === org.id)
                  const isManager = MANAGE_ROLES.has(org.role ?? '')
                  return (
                    <Disclosure key={org.id} id={org.id} aria-label={org.name}>
                      {({ isExpanded }) => (
                        <>
                      <Disclosure.Heading>
                        <Button
                          slot="trigger"
                          variant={isExpanded ? 'tertiary' : 'ghost'}
                          className="w-full justify-start"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate text-sm font-medium">{org.name}</span>
                            {org.role && (
                              <Chip size="sm" variant="primary">
                                <Chip.Label>{org.role}</Chip.Label>
                              </Chip>
                            )}
                            <Description className="shrink-0">
                              {workspaceCount(t, owned.length)}
                            </Description>
                          </div>
                          {org.id === currentOrg?.id && (
                            <Check className="size-4 shrink-0 text-accent" aria-label={t.rail.org.current} />
                          )}
                          <Disclosure.Indicator />
                        </Button>
                      </Disclosure.Heading>
                      <Disclosure.Content>
                        <Disclosure.Body>
                          {/* Workspaces scroll independently — cap at ~5 rows so a 50-workspace
                              org doesn't blow the popover height; actions stay pinned below. */}
                          {owned.length > 0 && (
                            <ScrollShadow className="max-h-[210px]" hideScrollBar>
                              <ListBox aria-label={org.name} selectionMode="none" onAction={handleAction}>
                                {owned.map((ws) => (
                                  <ListBox.Item key={ws.id} id={ws.id} textValue={ws.name}>
                                    <FolderOpen className="size-4 shrink-0 text-muted" />
                                    <Label>{ws.name}</Label>
                                    {ws.id === currentWorkspaceId && (
                                      <Check className="ms-auto size-4 text-accent" />
                                    )}
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </ScrollShadow>
                          )}
                          {isManager && (
                            <ListBox aria-label={`${org.name} actions`} selectionMode="none" onAction={handleAction}>
                              <ListBox.Item id={A.newWs(org.id)} textValue={t.rail.org.newWorkspace}>
                                <Plus className="size-4 shrink-0 text-muted" />
                                <Label>{t.rail.org.newWorkspace}</Label>
                              </ListBox.Item>
                              <ListBox.Item id={A.settings(org.id)} textValue={t.rail.org.orgSettings}>
                                <Settings className="size-4 shrink-0 text-muted" />
                                <Label>{t.rail.org.orgSettings}</Label>
                              </ListBox.Item>
                              <ListBox.Item id={A.people(org.id)} textValue={t.rail.org.people}>
                                <Users className="size-4 shrink-0 text-muted" />
                                <Label>{t.rail.org.people}</Label>
                              </ListBox.Item>
                              <ListBox.Item id={A.billing(org.id)} textValue={t.rail.org.billing}>
                                <Coins className="size-4 shrink-0 text-muted" />
                                <Label>{t.rail.org.billing}</Label>
                              </ListBox.Item>
                            </ListBox>
                          )}
                        </Disclosure.Body>
                      </Disclosure.Content>
                        </>
                      )}
                    </Disclosure>
                  )
                })}
              </DisclosureGroup>

              {canManage && (
                <>
                  <Separator />
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-start"
                    onPress={() => setForm({ kind: 'org' })}
                  >
                    <Plus className="size-4" /> {t.rail.org.newOrganization}
                  </Button>
                </>
              )}
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

type Strings = ReturnType<typeof useShellStrings>

function workspaceCount(t: Strings, n: number): string {
  return `${n} ${n === 1 ? t.rail.org.workspacesOne : t.rail.org.workspacesMany}`
}

// Inline create form (workspace or org) — replaces the list while open. HeroUI Form + TextField.
function CreateForm({
  t,
  form,
  onCancel,
  onCreateWorkspace,
  onCreateOrganization,
}: {
  t: Strings
  form: Exclude<FormState, null>
  onCancel: () => void
  onCreateWorkspace: (orgId: string, name: string) => Promise<void>
  onCreateOrganization: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isWorkspace = form.kind === 'workspace'
  const heading = isWorkspace ? t.rail.org.newWorkspace : t.rail.org.newOrganization
  const placeholder = isWorkspace
    ? t.rail.org.workspaceNamePlaceholder
    : t.rail.org.orgNamePlaceholder

  return (
    <Form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || busy) return
        setBusy(true)
        setError(null)
        try {
          if (isWorkspace) await onCreateWorkspace(form.orgId, trimmed)
          else await onCreateOrganization(trimmed)
          onCancel()
        } catch {
          setError(isWorkspace ? t.rail.org.createWorkspaceError : t.rail.org.createOrgError)
          setBusy(false)
        }
      }}
    >
      <TextField isRequired aria-label={heading} value={name} onChange={setName} isDisabled={busy}>
        <Label>{heading}</Label>
        <Input
          autoFocus
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
        />
        {error && <FieldError>{error}</FieldError>}
      </TextField>
      <Separator />
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" size="sm" isDisabled={busy} onPress={onCancel}>
          {t.rail.org.cancel}
        </Button>
        <Button type="submit" variant="primary" size="sm" isDisabled={busy || !name.trim()}>
          {busy ? <Spinner size="sm" /> : t.rail.org.create}
        </Button>
      </div>
    </Form>
  )
}
