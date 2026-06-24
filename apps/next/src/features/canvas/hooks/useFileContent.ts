import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readFile, writeFiles, subscribeFileChanges } from '@/core/files'
import { RunnerError } from '@/core/runner'
import { isTabularPath, parseTable } from '../lib/fileParsing'
import type { FileViewMode, ParsedTable } from '../types/file-reader'

// File-reader state owner: read (loading/error/empty/content) + revision-driven live refresh +
// edit/save. Island-side recreation of the legacy `FileContentView` effects (read :195-240, live
// `file_changed` :185-193, save :156-182) with the legacy bugs fixed (cancellable pulse timer,
// structured save result, first-fetch-only loader optimisation preserved).

const PULSE_MS = 1500

export interface UseFileContentArgs {
  sessionId: string | null
  projectId: string | null
  path: string
  rootId?: string
  /** Edit gate from authority — Edit offered only when not `'none'` AND the root is writable. */
  codeAuthority?: string
}

export interface UseFileContent {
  content: string
  loading: boolean
  error: string | null
  tabular: boolean
  viewMode: FileViewMode
  setViewMode: (m: FileViewMode) => void
  table: ParsedTable | null
  liveUpdated: boolean
  /** Edit affordance allowed (writable root + authority + session + non-tabular). */
  canEdit: boolean
  editing: boolean
  editContent: string
  setEditContent: (v: string) => void
  saving: boolean
  saveError: string | null
  enterEdit: () => void
  cancelEdit: () => void
  save: () => void
  dismissSaveError: () => void
  effectiveRootId: string
}

export function useFileContent(args: UseFileContentArgs): UseFileContent {
  const { sessionId, projectId, path, rootId, codeAuthority } = args

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [liveUpdated, setLiveUpdated] = useState(false)

  const tabular = isTabularPath(path)
  const [viewMode, setViewMode] = useState<FileViewMode>(tabular ? 'table' : 'raw')

  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const effectiveRootId = rootId ?? `app:${projectId ?? ''}`
  const isWritableRoot = effectiveRootId.startsWith('app:')
  const canEdit =
    !tabular &&
    Boolean(sessionId) &&
    isWritableRoot &&
    Boolean(codeAuthority) &&
    codeAuthority !== 'none'

  // No path-change reset effect: the screen is remounted per `openFile.path` by the canvas-shell
  // (React "key to reset"), so the initial state above (viewMode from `path`, editing=false,
  // saveError=null) is already correct on every path switch — no in-render/in-effect reset needed.

  // Live `file_changed` → bump revision for the matching path (silent re-fetch below).
  useEffect(() => {
    if (!sessionId) return
    const unsub = subscribeFileChanges(sessionId, (changedPath) => {
      if (changedPath === path) setRevision((r) => r + 1)
    })
    return () => unsub()
  }, [sessionId, path])

  // Read (loader only on first fetch; refreshes silent). Cancellable pulse timer (legacy bug #2).
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!sessionId || !projectId) {
      // Session/project dropped → clear to the no-session resting state (the screen shows the degraded
      // panel). A legitimate synchronous clear-on-input-loss (not derivable; must stop the loader).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent('')
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const isRefresh = revision > 0
    if (!isRefresh) setLoading(true)
    setError(null)
    readFile({ sessionId, rootId: effectiveRootId, path }, controller.signal)
      .then(({ content: text }) => {
        if (cancelled) return
        setContent(text)
        if (isRefresh) {
          setLiveUpdated(true)
          if (pulseTimer.current) clearTimeout(pulseTimer.current)
          pulseTimer.current = setTimeout(() => {
            if (!cancelled) setLiveUpdated(false)
          }, PULSE_MS)
        }
      })
      .catch((err) => {
        if (cancelled) return
        const msg =
          err instanceof RunnerError
            ? err.message
            : (err as Error)?.message || 'Network error'
        setError(msg)
        setContent('')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [sessionId, projectId, path, effectiveRootId, revision])

  // Parse only when a table is actually being rendered (keeps cost off non-tabular files).
  const table = useMemo<ParsedTable | null>(() => {
    if (!tabular || viewMode !== 'table' || !content) return null
    return parseTable(content, path)
  }, [tabular, viewMode, content, path])

  const enterEdit = useCallback(() => {
    setEditContent(content)
    setSaveError(null)
    setEditing(true)
  }, [content])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setSaveError(null)
  }, [])

  const dismissSaveError = useCallback(() => setSaveError(null), [])

  const save = useCallback(async () => {
    if (!sessionId) return
    setSaving(true)
    setSaveError(null)
    const result = await writeFiles({
      sessionId,
      files: [{ path, content: editContent, rootId: effectiveRootId }],
    })
    setSaving(false)
    if (result.ok) {
      setContent(editContent)
      setEditing(false)
    } else {
      setSaveError(result.error)
    }
  }, [sessionId, path, editContent, effectiveRootId])

  return {
    content,
    loading,
    error,
    tabular,
    viewMode,
    setViewMode,
    table,
    liveUpdated,
    canEdit,
    editing,
    editContent,
    setEditContent,
    saving,
    saveError,
    enterEdit,
    cancelEdit,
    save,
    dismissSaveError,
    effectiveRootId,
  }
}
