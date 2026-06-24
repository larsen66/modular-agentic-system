import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Chip, Input, Modal, Separator, Spinner, Surface,
  TextArea, TextField,
} from '@heroui/react'
import { Trash2, Plus, Save } from 'lucide-react'
import { runnerFetch } from '@/core/runner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SystemInstructionRow {
  template_slug: string
  surface_key: string | null
  system_instruction: string
}

interface TemplateGroup {
  slug: string
  label: string
  defaultBody: string
  hasDefaultRow: boolean
  overrides: Array<{ surfaceKey: string; body: string }>
}

// ─── View-model helpers ────────────────────────────────────────────────────────

const KNOWLEDGE_TEMPLATE_SLUGS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'react-vite-default', label: 'React Vite (Default)' },
  { slug: 'crm-v1', label: 'CRM v1' },
  { slug: 'crm-dubai-v1', label: 'CRM Dubai v1' },
  { slug: 'support-desk-v1', label: 'Support Desk v1' },
] as const

function parseInstructionRows(items: unknown): SystemInstructionRow[] {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>
    const rawSurface = r.surface_key
    return {
      template_slug: typeof r.template_slug === 'string' ? r.template_slug : '',
      surface_key: typeof rawSurface === 'string' && rawSurface.length > 0 ? rawSurface : null,
      system_instruction: typeof r.system_instruction === 'string' ? r.system_instruction : '',
    }
  })
}

function groupInstructionRows(rows: SystemInstructionRow[]): TemplateGroup[] {
  const bySlug = new Map<string, { defaultRow: SystemInstructionRow | null; overrides: SystemInstructionRow[] }>()
  for (const row of rows) {
    const bucket = bySlug.get(row.template_slug) ?? { defaultRow: null, overrides: [] }
    if (row.surface_key === null || row.surface_key === undefined) {
      bucket.defaultRow = row
    } else {
      bucket.overrides.push(row)
    }
    bySlug.set(row.template_slug, bucket)
  }
  return KNOWLEDGE_TEMPLATE_SLUGS.map(({ slug, label }) => {
    const bucket = bySlug.get(slug)
    const defaultRow = bucket?.defaultRow ?? null
    const overrides = (bucket?.overrides ?? [])
      .map((r) => ({ surfaceKey: r.surface_key as string, body: r.system_instruction ?? '' }))
      .sort((a, b) => a.surfaceKey.localeCompare(b.surfaceKey))
    return { slug, label, defaultBody: defaultRow?.system_instruction ?? '', hasDefaultRow: defaultRow !== null, overrides }
  })
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function OrgKnowledgeSection({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [rows, setRows] = useState<SystemInstructionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ slug: string; surfaceKey: string | null } | null>(null)

  const groups = useMemo(() => groupInstructionRows(rows), [rows])

  const getDraft = useCallback(
    (key: string, fallback = ''): string => (drafts[key] !== undefined ? drafts[key] : fallback),
    [drafts],
  )
  const setDraft = useCallback((key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }))
  }, [])

  const fetchInstructions = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await runnerFetch(`/org/${orgId}/system-instructions`)
      if (!res.ok) {
        if (res.status !== 404) setFetchError(`Failed to load instructions (${res.status})`)
        setRows([])
        return
      }
      const json = await res.json() as { items?: unknown }
      setRows(parseInstructionRows(json?.items))
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { void fetchInstructions() }, [fetchInstructions])

  async function putInstruction(templateSlug: string, body: string, surfaceKey: string | null): Promise<void> {
    const payload: Record<string, unknown> = { template_slug: templateSlug, system_instruction: body }
    if (surfaceKey !== null) payload.surface_key = surfaceKey
    const res = await runnerFetch(`/org/${orgId}/system-instructions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(detail?.error ?? `Failed to save (${res.status})`)
    }
  }

  async function deleteInstruction(templateSlug: string, surfaceKey: string | null): Promise<void> {
    const qs = surfaceKey === null ? 'surface_key=' : `surface_key=${encodeURIComponent(surfaceKey)}`
    const res = await runnerFetch(
      `/org/${orgId}/system-instructions/${encodeURIComponent(templateSlug)}?${qs}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const detail = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(detail?.error ?? `Failed to delete (${res.status})`)
    }
  }

  async function handleSave(slug: string, body: string, surfaceKey: string | null): Promise<void> {
    if (!canManage) return
    const key = surfaceKey === null ? `default:${slug}` : `override:${slug}:${surfaceKey}`
    if (!body.trim()) { setActionError('System instruction cannot be empty'); return }
    setActionError(null)
    setSavingKey(key)
    try {
      await putInstruction(slug, body, surfaceKey)
      await fetchInstructions()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingKey(null)
    }
  }

  async function handleAddOverride(slug: string): Promise<void> {
    if (!canManage) return
    const keyDraft = getDraft(`add-key:${slug}`).trim()
    const bodyDraft = getDraft(`add-body:${slug}`)
    if (!keyDraft) { setActionError('Surface key is required'); return }
    if (!bodyDraft.trim()) { setActionError('System instruction cannot be empty'); return }
    const collision = groups.find((g) => g.slug === slug)?.overrides.some((o) => o.surfaceKey === keyDraft)
    if (collision) { setActionError(`An override for "${keyDraft}" already exists — edit it instead`); return }
    setActionError(null)
    setSavingKey(`add:${slug}`)
    try {
      await putInstruction(slug, bodyDraft, keyDraft)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[`add-key:${slug}`]
        delete next[`add-body:${slug}`]
        return next
      })
      await fetchInstructions()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to add override')
    } finally {
      setSavingKey(null)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteConfirm) return
    const { slug, surfaceKey } = deleteConfirm
    const key = surfaceKey === null ? `default:${slug}` : `override:${slug}:${surfaceKey}`
    setDeleteConfirm(null)
    setActionError(null)
    setDeletingKey(key)
    try {
      await deleteInstruction(slug, surfaceKey)
      await fetchInstructions()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <Surface variant="default" className="mx-auto w-full max-w-2xl rounded-3xl p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-base font-semibold text-foreground">Knowledge</p>
        <p className="text-sm text-muted">
          Configure system instructions per app template. These are prepended to every AI interaction.
          Add a surface override (e.g. <code className="font-mono text-xs">mount:sales</code>) to
          send a different instruction to specific surfaces while the default stays in place.
        </p>
      </div>

      {fetchError && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{fetchError}</Alert.Description></Alert.Content>
        </Alert>
      )}
      {actionError && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{actionError}</Alert.Description></Alert.Content>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted"><Spinner size="sm" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const defaultKey = `default:${group.slug}`
            const addKeyField = `add-key:${group.slug}`
            const addBodyField = `add-body:${group.slug}`
            const defaultBody = getDraft(defaultKey, group.defaultBody)
            const addKeyDraft = getDraft(addKeyField).trim()
            const addBodyDraft = getDraft(addBodyField)
            const isAddDisabled = !canManage || savingKey === `add:${group.slug}` || !addKeyDraft || !addBodyDraft.trim()

            return (
              <Surface key={group.slug} variant="secondary" className="rounded-2xl p-4 space-y-4">
                {/* Template header */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{group.label}</p>
                  <code className="text-xs text-muted font-mono">{group.slug}</code>
                </div>

                {/* Default row */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="soft">Default</Chip>
                    <span className="text-xs text-muted">Applies to every surface unless overridden.</span>
                  </div>
                  <TextField
                    name={defaultKey}
                    value={defaultBody}
                    onChange={(v) => setDraft(defaultKey, v)}
                    isReadOnly={!canManage}
                    aria-label={`Default system instruction for ${group.slug}`}
                  >
                    <TextArea variant="secondary" rows={4} className="font-mono text-xs" placeholder="Enter default system instruction for this template…" />
                  </TextField>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {defaultBody.length > 0 ? `${defaultBody.length} chars` : group.hasDefaultRow ? 'No instruction set' : 'No row on server'}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        {group.hasDefaultRow && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isDisabled={deletingKey === defaultKey}
                            onPress={() => setDeleteConfirm({ slug: group.slug, surfaceKey: null })}
                            aria-label={`Delete default for ${group.slug}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          isDisabled={!defaultBody.trim() || savingKey === defaultKey}
                          onPress={() => void handleSave(group.slug, defaultBody, null)}
                        >
                          <Save className="size-3.5" />
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Override rows */}
                {group.overrides.map((override) => {
                  const overrideKey = `override:${group.slug}:${override.surfaceKey}`
                  const overrideBody = getDraft(overrideKey, override.body)
                  return (
                    <div key={overrideKey} className="space-y-2">
                      <Separator />
                      <div className="flex items-center gap-2">
                        <Chip size="sm" variant="soft" color="accent">Override</Chip>
                        <code className="text-xs font-mono text-foreground">{override.surfaceKey}</code>
                      </div>
                      <TextField
                        name={overrideKey}
                        value={overrideBody}
                        onChange={(v) => setDraft(overrideKey, v)}
                        isReadOnly={!canManage}
                        aria-label={`Override instruction for ${group.slug} · ${override.surfaceKey}`}
                      >
                        <TextArea variant="secondary" rows={4} className="font-mono text-xs" placeholder="Enter surface-specific system instruction…" />
                      </TextField>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">{overrideBody.length > 0 ? `${overrideBody.length} chars` : 'Empty override'}</span>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              isDisabled={deletingKey === overrideKey}
                              onPress={() => setDeleteConfirm({ slug: group.slug, surfaceKey: override.surfaceKey })}
                              aria-label={`Delete override ${override.surfaceKey} for ${group.slug}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              isDisabled={!overrideBody.trim() || savingKey === overrideKey}
                              onPress={() => void handleSave(group.slug, overrideBody, override.surfaceKey)}
                            >
                              <Save className="size-3.5" />
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Add surface override form */}
                {canManage && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Plus className="size-3.5 text-muted" />
                      <span className="text-xs text-muted">Add surface override</span>
                    </div>
                    <TextField
                      name={addKeyField}
                      value={getDraft(addKeyField)}
                      onChange={(v) => setDraft(addKeyField, v)}
                      aria-label={`New surface key for ${group.slug}`}
                    >
                      <Input variant="secondary" className="font-mono text-xs" placeholder="Surface key (e.g. mount:sales)" />
                    </TextField>
                    <TextField
                      name={addBodyField}
                      value={getDraft(addBodyField)}
                      onChange={(v) => setDraft(addBodyField, v)}
                      aria-label={`New override body for ${group.slug}`}
                    >
                      <TextArea variant="secondary" rows={3} className="font-mono text-xs" placeholder="Surface-specific system instruction…" />
                    </TextField>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        isDisabled={isAddDisabled}
                        onPress={() => void handleAddOverride(group.slug)}
                      >
                        <Plus className="size-3.5" />
                        Add override
                      </Button>
                    </div>
                  </div>
                )}
              </Surface>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal.Backdrop isOpen={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>Confirm delete</Modal.Heading></Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground">
                Delete the{' '}
                {deleteConfirm?.surfaceKey === null
                  ? 'default'
                  : <>override <code className="font-mono text-xs">{deleteConfirm?.surfaceKey}</code></>
                }{' '}
                instruction for <code className="font-mono text-xs">{deleteConfirm?.slug}</code>?
                This cannot be undone.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onPress={() => void confirmDelete()}>Delete</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Surface>
  )
}
