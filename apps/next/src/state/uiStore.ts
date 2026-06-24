import { create } from 'zustand'
import { DEFAULT_LANGUAGE, isSupportedLanguage, type LanguageCode } from '@/i18n'

/** A pinned open chat in the tab strip. */
export interface ChatTab {
  chatId: string
  projectId: string
  workspaceId?: string
  surfaceKey?: string
  title: string | null
}

// Island-local, cross-cutting UI state ONLY (not server state — that lives behind src/core/**).
// Theme + language + rail nav mode. Surface-specific UI state belongs inside each feature module.
// Theme is CSS-driven (HeroUI dark-mode: toggle the `dark` class on <html>).
export type ThemePref = 'light' | 'dark' | 'system'

const THEME_KEY = 'island-theme'
const LANG_KEY = 'island-language'
const EXPLORER_WIDTH_KEY = 'island-explorer-width'
const PREVIEW_WIDTH_KEY = 'island-preview-width'
const ORG_KEY = 'island-active-org'
const PRE_SETTINGS_PATH_KEY = 'island-pre-settings-path'
const CHAT_TABS_KEY = 'island-chat-tabs'

// Chat tabs are scoped per organization (switching orgs swaps the open set). Persisted as a
// { [orgId]: ChatTab[] } map; the bucket for a not-yet-resolved org is keyed by ORG_NONE.
const ORG_NONE = '__none__'
const orgKey = (orgId: string | null): string => orgId ?? ORG_NONE

function readChatTabsByOrg(): Record<string, ChatTab[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CHAT_TABS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Legacy format was a flat ChatTab[] (org-agnostic). Drop it once — tabs are cheap to reopen.
    if (Array.isArray(parsed)) return {}
    return parsed as Record<string, ChatTab[]>
  } catch {
    return {}
  }
}

function writeChatTabsByOrg(map: Record<string, ChatTab[]>): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(CHAT_TABS_KEY, JSON.stringify(map))
}

function readPreSettingsPath(): string {
  if (typeof window === 'undefined') return '/'
  return window.localStorage.getItem(PRE_SETTINGS_PATH_KEY) ?? '/'
}

// Explorer dock width bounds (reinvented from legacy 160–400; see flows/explorer-open-close.md §3).
export const EXPLORER_MIN_WIDTH = 220
export const EXPLORER_MAX_WIDTH = 480
export const EXPLORER_DEFAULT_WIDTH = 280

/** Clamp a candidate Explorer width into [min, max]; non-finite → default. */
export function clampExplorerWidth(w: number): number {
  if (!Number.isFinite(w)) return EXPLORER_DEFAULT_WIDTH
  return Math.min(EXPLORER_MAX_WIDTH, Math.max(EXPLORER_MIN_WIDTH, Math.round(w)))
}

function readExplorerWidth(): number {
  if (typeof window === 'undefined') return EXPLORER_DEFAULT_WIDTH
  const s = window.localStorage.getItem(EXPLORER_WIDTH_KEY)
  const n = s ? Number(s) : Number.NaN
  return Number.isFinite(n) ? clampExplorerWidth(n) : EXPLORER_DEFAULT_WIDTH
}

// Preview-pane geometry (the Stage's second pane). Unlike the Explorer (fixed [min,max] dock), the
// Preview's upper bound is the live Stage width: it may grow until only a thin gutter of chat is
// left, at which point it floats *over* the chat (overlay-resize, see app/shell/Stage.tsx). So the
// store clamps only the floor; the container-relative ceiling is applied at render where the Stage
// width is known.
export const PREVIEW_MIN_WIDTH = 400
export const PREVIEW_DEFAULT_WIDTH = 640
// The chat never lays out narrower than this when the two panes tile side-by-side; past it the
// preview overlaps instead of squeezing the chat further.
export const CHAT_MIN_WIDTH = 380
// Always keep at least this much chat visible (clickable to bring it back to front) when the preview
// overlays it — the resizer can never fully bury the chat.
export const PREVIEW_EDGE_GUTTER = 56

/** Clamp a preview width to its container. Floor = PREVIEW_MIN_WIDTH; ceiling = container − gutter
 *  (only when a positive container is known — otherwise floor only). */
export function clampPreviewWidth(w: number, container = 0): number {
  const candidate = Number.isFinite(w) ? Math.round(w) : PREVIEW_DEFAULT_WIDTH
  const ceiling =
    container > 0 ? Math.max(PREVIEW_MIN_WIDTH, container - PREVIEW_EDGE_GUTTER) : Number.POSITIVE_INFINITY
  return Math.min(ceiling, Math.max(PREVIEW_MIN_WIDTH, candidate))
}

function readPreviewWidth(): number {
  if (typeof window === 'undefined') return PREVIEW_DEFAULT_WIDTH
  const s = window.localStorage.getItem(PREVIEW_WIDTH_KEY)
  const n = s ? Number(s) : Number.NaN
  return Number.isFinite(n) ? clampPreviewWidth(n) : PREVIEW_DEFAULT_WIDTH
}

function readTheme(): ThemePref {
  if (typeof window === 'undefined') return 'system'
  const s = window.localStorage.getItem(THEME_KEY)
  return s === 'light' || s === 'dark' || s === 'system' ? s : 'system'
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref): void {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  window.localStorage.setItem(THEME_KEY, pref)
}

function readLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const s = window.localStorage.getItem(LANG_KEY)
  return s && isSupportedLanguage(s) ? s : DEFAULT_LANGUAGE
}

// The user's last-picked org id, persisted across refreshes. Validity is checked by consumers
// (useActiveOrg falls back to the first org if this id is no longer in the user's org list).
function readActiveOrg(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ORG_KEY)
}

// Rail navigation mode — the active surface the Rail/Explorer reflect. Shell-level cross-cutting
// UI state (the Explorer area, once built, reads activeMode to choose its panel). Defined here
// (not in features/) so lower layers never import a feature module.
export type RailMode = 'explorer' | 'files' | 'people' | 'history' | 'settings'

// Which body the Explorer panel shows in `explorer` mode: the node tree or the flat chat list.
export type ExplorerView = 'nodes' | 'chats'

// Which Stage pane is on top when Chat + Preview overlap (the click-to-front layering).
export type PreviewLayer = 'chat' | 'preview'
export type StageOrient = 'row' | 'col'

export interface StageLayout {
  orient: StageOrient
  order: string[]
  ratio: number
}

export type SelectedNode =
  | { kind: 'app'; id: string; name: string; appId?: string; appName?: string }
  | { kind: 'chat'; id: string; name: string; appId?: string; appName?: string }
  | { kind: 'folder'; id: string; name: string; appId?: string; appName?: string }



interface UiState {
  theme: ThemePref
  setTheme: (t: ThemePref) => void
  language: LanguageCode
  setLanguage: (l: LanguageCode) => void
  activeMode: RailMode
  setActiveMode: (m: RailMode) => void
  // Path to restore when leaving settings (set before entering settings).
  preSettingsPath: string
  setPreSettingsPath: (path: string) => void
  // Active organization — the scope every surface below the Rail (Explorer tree, Stage) reads. The
  // user's explicit pick; null until chosen (consumers fall back to the first org). Cross-cutting.
  activeOrgId: string | null
  setActiveOrgId: (orgId: string | null) => void
  // Explorer dock — the second-layer panel that opens out of the rail.
  explorerOpen: boolean
  setExplorerOpen: (open: boolean) => void
  explorerWidth: number
  setExplorerWidth: (w: number) => void
  explorerView: ExplorerView
  setExplorerView: (v: ExplorerView) => void
  // Selection — what the Stage will host. Cross-cutting (read by the Stage when built), so it lives
  // here, not inside the feature module.
  activeNodeId: string | null
  activeChatId: string | null
  selectNode: (nodeId: string | null) => void
  selectChat: (chatId: string | null) => void
  /** Mirror the URL (the authority) into selection state for Explorer highlight. */
  applyRouteSelection: (nodeId: string | null, chatId: string | null) => void
  // Stage layout — the content area hosts the Chat pane and, when opened, a second Preview pane.
  // previewOpen=false → Chat is centered (single pane); previewOpen=true → Chat shifts left and
  // Preview takes the right (two panes). Cross-cutting layout state read by the Stage; Preview
  // itself is not built yet (see app/shell/Stage.tsx). Per chat/AREA.md (≤2 primary panes).
  previewOpen: boolean
  setPreviewOpen: (open: boolean) => void
  togglePreview: () => void
  // Preview pane width. Persisted; clamped to its floor here, to the live Stage width at render.
  previewWidth: number
  setPreviewWidth: (w: number) => void
  // Which pane is on top when the two overlap; opening the preview brings it to front.
  previewLayer: PreviewLayer
  setPreviewLayer: (layer: PreviewLayer) => void
  // Canvas page — a page tab open inside the canvas pane (e.g. marketplace).
  // Only the id + label are stored here; Stage composes the ReactNode content.
  canvasPage: { id: string; label: string } | null
  setCanvasPage: (page: { id: string; label: string } | null) => void
  // Active session — the runner session for the currently-active project/chat.
  // Written by useChat when the session lifecycle resolves a sessionId; cleared on unmount.
  // The canvas pane reads this to subscribe to the live preview for the session in view.
  activeSessionId: string | null
  setActiveSessionId: (sessionId: string | null) => void
  // Chat tab strip — the horizontally-pinned open chats above the message area. `chatTabs` is the
  // live slice for the active org; `chatTabsByOrg` is the persisted per-org backing map.
  chatTabs: ChatTab[]
  chatTabsByOrg: Record<string, ChatTab[]>
  openChatTab: (tab: Omit<ChatTab, 'title'> & { title?: string | null }) => void
  closeChatTab: (chatId: string) => void
  updateChatTabTitle: (chatId: string, title: string | null) => void
  reorderChatTabs: (fromIndex: number, toIndex: number) => void
  // Stage — the main content area split layout (screen registry + orient + ratio).
  stage: StageLayout
  setStage: (layout: Partial<StageLayout>) => void
  // Selected node — the app/chat/folder selected in the Explorer, drives what Stage renders.
  selectedNode: SelectedNode | null
  selectedNodeName: string | null
  setSelectedNode: (node: SelectedNode | null) => void
  
}

const initialOrgId = readActiveOrg()
const initialChatTabsByOrg = readChatTabsByOrg()

export const useUiStore = create<UiState>((set) => ({
  theme: readTheme(),
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  language: readLanguage(),
  setLanguage: (l) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(LANG_KEY, l)
    set({ language: l })
  },
  activeMode: (typeof window !== 'undefined' && window.location.pathname.includes('/settings'))
    ? 'settings'
    : 'explorer',
  // Clicking a rail mode opens the Explorer to that mode (flows/explorer-open-close.md §3 step 1).
  setActiveMode: (m) =>
    set((s) =>
      s.activeMode === m
        ? {} // no-op: clicking the already-active mode does not force-open the Explorer
        : { activeMode: m, explorerOpen: true },
    ),
  preSettingsPath: readPreSettingsPath(),
  setPreSettingsPath: (path) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(PRE_SETTINGS_PATH_KEY, path)
    set({ preSettingsPath: path })
  },

  activeOrgId: initialOrgId,
  // Switching org resets node/chat selection (a new scope) and persists the pick so a refresh keeps
  // the same org. On an actual org CHANGE it also swaps the chat-tab strip to that org's set and
  // resets the preview pane (the old org's preview/marketplace tab must not bleed into the new one).
  setActiveOrgId: (orgId) => {
    if (typeof window !== 'undefined') {
      if (orgId) window.localStorage.setItem(ORG_KEY, orgId)
      else window.localStorage.removeItem(ORG_KEY)
    }
    set((s) => {
      const orgChanged = orgId !== s.activeOrgId
      if (!orgChanged) return { activeOrgId: orgId, activeNodeId: null, activeChatId: null }
      return {
        activeOrgId: orgId,
        activeNodeId: null,
        activeChatId: null,
        chatTabs: s.chatTabsByOrg[orgKey(orgId)] ?? [],
        canvasPage: null,
        previewOpen: false,
      }
    })
  },

  explorerOpen: true,
  setExplorerOpen: (open) => set({ explorerOpen: open }),
  explorerWidth: readExplorerWidth(),
  setExplorerWidth: (w) => {
    const width = clampExplorerWidth(w)
    if (typeof window !== 'undefined') window.localStorage.setItem(EXPLORER_WIDTH_KEY, String(width))
    set({ explorerWidth: width })
  },
  explorerView: 'nodes',
  setExplorerView: (v) => set({ explorerView: v }),

  activeNodeId: null,
  activeChatId: null,
  // Selecting a node enters a new node context → the active chat resets; selecting a chat keeps the
  // node. Cross-project chat selection: the caller sets the node first, then the chat.
  selectNode: (nodeId) => set({ activeNodeId: nodeId, activeChatId: null }),
  selectChat: (chatId) => set({ activeChatId: chatId }),
  applyRouteSelection: (nodeId, chatId) => set({ activeNodeId: nodeId, activeChatId: chatId }),

  // Opening the preview always brings it to front (resets the overlap layering) — done here so the
  // Stage needs no focus-reset effect (which the set-state-in-effect lint rule forbids).
  // Starts closed: the canvas page (e.g. marketplace) is an ephemeral, in-session tab — it must NOT
  // re-open on refresh (the old behaviour left the preview stuck on the marketplace everywhere).
  previewOpen: false,
  setPreviewOpen: (open) =>
    set(open ? { previewOpen: true, previewLayer: 'preview' } : { previewOpen: false }),
  togglePreview: () =>
    set((s) => (s.previewOpen ? { previewOpen: false } : { previewOpen: true, previewLayer: 'preview' })),

  previewWidth: readPreviewWidth(),
  setPreviewWidth: (w) => {
    // Persist the floor-clamped value; the Stage applies the container ceiling on top of this when
    // it renders (and the resizer already clamps to the container before calling us).
    const width = clampPreviewWidth(w)
    if (typeof window !== 'undefined') window.localStorage.setItem(PREVIEW_WIDTH_KEY, String(width))
    set({ previewWidth: width })
  },

  previewLayer: 'preview',
  setPreviewLayer: (layer) => set({ previewLayer: layer }),

  canvasPage: null,
  // Opening a canvas page also opens the preview pane and brings it to front. Ephemeral — not
  // persisted, so it never survives a refresh (see previewOpen above).
  setCanvasPage: (page) => {
    set(page ? { canvasPage: page, previewOpen: true, previewLayer: 'preview' } : { canvasPage: null })
  },

  activeSessionId: null,
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),

  chatTabsByOrg: initialChatTabsByOrg,
  chatTabs: initialChatTabsByOrg[orgKey(initialOrgId)] ?? [],
  openChatTab: (tab) =>
    set((s) => {
      const key = orgKey(s.activeOrgId)
      const cur = s.chatTabsByOrg[key] ?? []
      if (cur.some((t) => t.chatId === tab.chatId)) return {}
      const next = [...cur, { ...tab, title: tab.title ?? null }]
      const map = { ...s.chatTabsByOrg, [key]: next }
      writeChatTabsByOrg(map)
      return { chatTabsByOrg: map, chatTabs: next }
    }),
  closeChatTab: (chatId) =>
    set((s) => {
      const key = orgKey(s.activeOrgId)
      const next = (s.chatTabsByOrg[key] ?? []).filter((t) => t.chatId !== chatId)
      const map = { ...s.chatTabsByOrg, [key]: next }
      writeChatTabsByOrg(map)
      return { chatTabsByOrg: map, chatTabs: next }
    }),
  updateChatTabTitle: (chatId, title) =>
    set((s) => {
      const key = orgKey(s.activeOrgId)
      const next = (s.chatTabsByOrg[key] ?? []).map((t) => (t.chatId === chatId ? { ...t, title } : t))
      const map = { ...s.chatTabsByOrg, [key]: next }
      writeChatTabsByOrg(map)
      return { chatTabsByOrg: map, chatTabs: next }
    }),
  reorderChatTabs: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex === toIndex) return {}
      const key = orgKey(s.activeOrgId)
      const next = (s.chatTabsByOrg[key] ?? []).slice()
      const [tab] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, tab)
      const map = { ...s.chatTabsByOrg, [key]: next }
      writeChatTabsByOrg(map)
      return { chatTabsByOrg: map, chatTabs: next }
    }),
  stage: { orient: 'row', order: ['chat', 'preview'], ratio: 0.5 },
  setStage: (layout) => set((s) => ({ stage: { ...s.stage, ...layout } })),

  selectedNode: null,
  selectedNodeName: null,
  setSelectedNode: (node) => set({ selectedNode: node, selectedNodeName: node?.name ?? null }),

}))