// The chat area message model. runReducer.ts maps runner stream events → ChatMessage[].
// The local ChatMessage is a superset of UIMessage's core fields plus run-lifecycle metadata.
import type { ChatStatus } from 'ai'
export type { ChatStatus }

/** Per-message fields used by the run reducer and transcript UI. */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  text: string
  /** Legacy AI SDK UIMessage parts (used by streamReducer / historyMapper adapters). */
  parts?: unknown[]
  status: 'pending' | 'streaming' | 'complete' | 'error'
  createdAt?: string
  runId?: string
  model?: string
  provider?: string
  attachments?: Array<{ name?: string; contentType?: string; url?: string }>
  toolCalls?: ToolCallView[]
  todoItems?: TodoView[]
  reasoning?: string
  modifiedFiles?: string[]
  gitStatus?: string
  permission?: PendingPermission
  question?: { prompt: string; options?: string[]; answered?: boolean }
  visualVerification?: { status: string }
  failover?: { requested: string; actual: string; reason: string }
  handoff?: { status: string }
  errorCode?: string
}

/** Backend run phases (from shared/chat-events RunPhase). Terminal = settled_x or cancelled. */
export type RunPhase =
  | 'idle'
  | 'dispatching'
  | 'preparing'
  | 'streaming'
  | 'waiting_input'
  | 'waiting_children'
  | 'verifying'
  | 'settled_success'
  | 'settled_incomplete'
  | 'settled_error'
  | 'cancelled'

export const TERMINAL_PHASES: ReadonlySet<RunPhase> = new Set<RunPhase>([
  'settled_success',
  'settled_incomplete',
  'settled_error',
  'cancelled',
])

/** A normalized pending guided-intake question. */
export interface PendingQuestion {
  requestID: string
  callID?: string
  questions: {
    id: string
    kind: 'single' | 'multi' | 'text'
    prompt: string
    options?: string[]
    allowCustomInput?: boolean
  }[]
}

/**
 * A normalized pending tool-permission request (the `permission` SSE event).
 * The `decided` field is set optimistically after the user responds.
 */
export interface PendingPermission {
  permissionId: string
  permissionKind?: string
  toolName?: string
  filePath?: string
  patterns?: string[]
  callID?: string
  /** Set after user responds (optimistic UI update). */
  decided?: 'allow_once' | 'allow' | 'deny'
}

export interface ToolCallView {
  callID: string
  tool: string
  toolState: 'running' | 'completed' | 'error'
  file?: string
  content?: string
  delegationState?: 'attempt' | 'child_session' | 'failed_attempt'
}

export interface TodoView {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

/** One typed event from the runner SSE stream. */
export interface RunStreamEvent {
  eventType: string
  data?: Record<string, unknown>
}

/** Per-chat run state owned by the chat store. */
export interface RunState {
  runId: string | null
  phase: RunPhase
  status: ChatStatus
  version: number
  isStreaming: boolean
  messages: ChatMessage[]
  pendingQuestion: PendingQuestion | null
  pendingPermission: PendingPermission | null
  error: { message: string; code?: string } | null
  /** Token usage (+ optional cost) accumulated from kernel usage_delta / settled frames. */
  usage?: { inputTokens: number; outputTokens: number; cost?: number } | null
  /** A non-stream admission rejection (writer-lock, balance, etc.) for the banner. */
  rejection: {
    code: string
    message: string
    retryAfter?: number
    balance?: { current: number; threshold: number; orgId?: string }
  } | null
}

export const IDLE_RUN: RunState = {
  runId: null,
  phase: 'idle',
  status: 'ready',
  version: 0,
  isStreaming: false,
  messages: [],
  pendingQuestion: null,
  pendingPermission: null,
  error: null,
  usage: null,
  rejection: null,
}

/** Props for the chat pane screen. */
export interface ChatPaneScreenProps {
  chatId: string
  sessionId?: string | null
  readOnly?: boolean
}

/** Props for the Transcript component. */
export interface TranscriptProps {
  messages: ChatMessage[]
  isStreaming?: boolean
  onAnswer?: (requestID: string, answers: string[][]) => void
  onPermissionRespond?: (permissionId: string, action: string) => void
  onTopUp?: () => void
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
}

/** Props for the Composer component. */
export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
  provisioningHint?: string | null
  selectorSlot?: React.ReactNode
  onAttachFiles?: (files?: File[]) => void
  attachments?: Array<{ id: string; name: string; contentType?: string; url?: string; size?: number }>
  onRemoveAttachment?: (id: string) => void
  onToggleVoice?: () => void
  isRecording?: boolean
  onToggleElementPicker?: () => void
  pickerActive?: boolean
}

/** What the user has selected (agent mode, model, effort, kernel harness×environment). */
export interface ChatSelection {
  agentModeId: string
  modelId: string
  effortId: string
  /** Kernel run target. 'auto' (or undefined) → the kernel's own default (PI when a model key exists). */
  harness?: string
  environment?: string
  topology?: string
}

/** A banner shown when a send is rejected. */
export interface RejectionBanner {
  code: string
  message: string
}

/** Props for the ChatPaneScreen (same as ChatPaneScreenProps). */
export interface ChatPaneProps {
  chatId: string
  sessionId?: string | null
  readOnly?: boolean
}

/** Props for a chat pane screen — alias kept for compat. */
export type { ChatPaneScreenProps as ChatHostScreenProps }

/** A model option for the selectors. */
export interface SelectorModelOption {
  id: string
  label: string
  available?: boolean
  provider?: string
  model?: string
  isPinned?: boolean
}

/** Props for the Selectors component. */
export interface SelectorsProps {
  selection: ChatSelection
  onChange: (sel: ChatSelection) => void
  models?: (SelectorModelOption & { model?: string; provider?: string; available?: boolean })[]
  /** Kernel registry listings (GET /registry) driving the harness×environment selector. */
  harnesses?: string[]
  environments?: string[]
  disabled?: boolean
}

/** Props for the MessageRow component. */
export interface MessageRowProps {
  message: ChatMessage
  /** Called with a plain text answer (from inline question card). */
  onAnswer?: (answer: string) => void
  onPermissionRespond?: (permissionId: string, action: 'allow_once' | 'allow' | 'deny') => void
  onTopUp?: () => void
}
