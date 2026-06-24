// Domain types + component prop contracts for the canvas `file-reader` screen (ARCHITECTURE §3).
// Seam/contract types (file read/write) are DEFINED in the access layer (`@/core/files`) and
// re-exported here, not redefined.

export type { FileContent, WriteFilesResult } from '@/core/files'

// ── Domain ──

/** CSV/TSV view mode toggle. */
export type FileViewMode = 'table' | 'raw'

/** Result of parsing a delimited (CSV/TSV) file. */
export interface ParsedTable {
  /** Sniffed delimiter (`,` `;` `\t`). */
  delimiter: string
  /** Header row + rendered data rows (capped at `MAX_TABLE_ROWS`). */
  rows: string[][]
  /** True when more data rows exist than were rendered (cap hit). */
  truncated: boolean
  /** Total data rows in the file (incl. header), used in the truncation notice. */
  totalRows: number
}

/** The resolved file-reader state machine value (one rendered region at a time). */
export type FileReaderStatus =
  | 'loading'
  | 'error'
  | 'empty'
  | 'code'
  | 'table'
  | 'editing'

// ── Component props ──

/** The file-reader screen — opened for one workspace file (tab id `file:<rootId>:<path>`). */
export interface FileReaderProps {
  /** Workspace-relative file path (e.g. `src/App.tsx`). */
  path: string
  /** Display name (basename) shown in the toolbar Chip. */
  name: string
  /** Root id (`app:<projectId>` writable / `repo:*` read-only). Defaults to `app:<projectId>`. */
  rootId?: string
  /** Active runner session; null → no-session degraded panel. */
  sessionId?: string | null
  /** Project id — used to derive the default `app:<projectId>` root. */
  projectId?: string | null
  /**
   * Edit authority (from `surfaceConfig(...).codeAuthority`). Edit is offered only when this is
   * NOT `'none'` AND the root is writable. Defaults to `'none'` (read-only) when omitted.
   */
  codeAuthority?: 'none' | 'read' | 'write' | string
}

/** The toolbar strip — filename + path + state-swapped mode controls. */
export interface FileToolbarProps {
  name: string
  path: string
  /** CSV/TSV → show the Table/Raw toggle. */
  tabular: boolean
  viewMode: FileViewMode
  onViewModeChange: (m: FileViewMode) => void
  /** Whether the Edit affordance is allowed (writable root + authority + session + non-tabular). */
  canEdit: boolean
  editing: boolean
  saving: boolean
  /** Transient "• updated" pulse after a live refresh landed. */
  liveUpdated: boolean
  /** Inline save error (shown only while editing). */
  saveError: string | null
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDismissSaveError: () => void
}

/** Read-only syntax-highlighted code view (Shiki via `@streamdown/code`, with a plain `<pre>` fallback). */
export interface CodeViewProps {
  content: string
  /** Resolved highlighter language id (`languageForPath`). */
  language: string
}

/** Read-only "editor" — v1 is a read-only `<pre>` mirror; editable Monaco needs a dep (see notes). */
export interface FileEditViewProps {
  value: string
  onChange: (v: string) => void
  language: string
  /** True until an editable editor dep is added — renders read-only + an honest notice. */
  readOnly: boolean
}

/** HeroUI Table rendering of a parsed CSV/TSV file. */
export interface CsvTableProps {
  table: ParsedTable
}
