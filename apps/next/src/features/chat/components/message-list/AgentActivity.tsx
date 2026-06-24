// Agent activity (design: docs/design/chat/screens/message-list.md §3 "agent activity").
// Renders the agent's WORK inside an assistant turn: reasoning, tool calls, todo plan, modified
// files. Minimalist HeroUI v3 (Chip/Card + structural layout) — no custom CSS. Data model mirrors
// the legacy toolCalls[]/todoItems[] (src/types/chat.ts), populated by runReducer from progress events.

import { Card, Chip } from '@heroui/react'
import { useChatStrings } from '../../i18n'
import type { ChatMessage, ToolCallView } from '../../types'

const TOOL_STATE_COLOR: Record<ToolCallView['toolState'], 'default' | 'success' | 'danger'> = {
  running: 'default',
  completed: 'success',
  error: 'danger',
}

const TODO_STATE_COLOR: Record<string, 'default' | 'accent' | 'success' | 'warning'> = {
  pending: 'default',
  in_progress: 'accent',
  completed: 'success',
  cancelled: 'warning',
}

function ToolCallRow({ tc }: { tc: ToolCallView }) {
  const t = useChatStrings()
  const label = tc.delegationState === 'child_session' ? t.agent.subAgent : tc.tool
  return (
    <div className="flex flex-col gap-1" data-testid="tool-call" data-tool={tc.tool} data-state={tc.toolState}>
      <div className="flex items-center gap-2">
        <Chip color={TOOL_STATE_COLOR[tc.toolState]}>{label}</Chip>
        {tc.file && <span className="text-sm text-muted-foreground">{tc.file}</span>}
      </div>
      {tc.content && (
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{tc.content}</div>
      )}
    </div>
  )
}

export function AgentActivity({ message }: { message: ChatMessage }) {
  const t = useChatStrings()
  const hasReasoning = !!message.reasoning
  const hasTools = !!message.toolCalls?.length
  const hasTodos = !!message.todoItems?.length
  const hasFiles = !!message.modifiedFiles?.length
  if (!hasReasoning && !hasTools && !hasTodos && !hasFiles) return null

  return (
    <div className="flex flex-col gap-2" data-testid="agent-activity">
      {hasReasoning && (
        <Card data-testid="reasoning">
          <Card.Header><Card.Title>{t.agent.reasoning}</Card.Title></Card.Header>
          <Card.Description className="whitespace-pre-wrap">{message.reasoning}</Card.Description>
        </Card>
      )}

      {hasTodos && (
        <Card data-testid="todo-list">
          <Card.Header><Card.Title>{t.agent.plan}</Card.Title></Card.Header>
          <div className="flex flex-col gap-1 p-3 pt-0">
            {message.todoItems!.map((t, i) => (
              <div key={i} className="flex items-center gap-2" data-testid="todo-item" data-status={t.status}>
                <Chip color={TODO_STATE_COLOR[t.status] ?? 'default'}>{t.status}</Chip>
                <span className="text-sm text-foreground">{t.content}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {hasTools && (
        <div className="flex flex-col gap-2" data-testid="tool-calls">
          {message.toolCalls!.map((tc) => <ToolCallRow key={tc.callID} tc={tc} />)}
        </div>
      )}

      {hasFiles && (
        <div className="flex flex-wrap gap-1.5" data-testid="modified-files">
          {message.modifiedFiles!.map((f) => <Chip key={f}>{f}</Chip>)}
        </div>
      )}
    </div>
  )
}
