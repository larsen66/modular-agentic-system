import { useMemo, useState, type FormEvent } from 'react'
import { Button, Chip } from '@heroui/react'
import { Bot, Paperclip, Send, UserRound } from 'lucide-react'
import { useUiStore } from '@/state/uiStore'
import { EmptyState } from '@/shared/EmptyState'
import { useChatThread } from '../hooks/useChatThread'
import type { ChatMessageRole } from '@/core/chats'

type MessageRole = ChatMessageRole

interface Message {
  id: string
  role: MessageRole
  body: string
  status?: 'done' | 'working'
}

const BASE_MESSAGES: Message[] = [
  {
    id: 'assistant-ready',
    role: 'assistant',
    body: 'I am ready to work in this Stage pane.',
    status: 'done',
  },
]

function roleClasses(role: MessageRole) {
  return role === 'user'
    ? 'ml-auto bg-primary text-primary-foreground'
    : 'mr-auto border border-border bg-content1 text-foreground'
}

function RoleIcon({ role }: { role: MessageRole }) {
  const Icon = role === 'user' ? UserRound : Bot
  return <Icon className="size-3.5" aria-hidden="true" />
}

export function ThreadScreen() {
  const selectedNode = useUiStore((s) => s.selectedNode)
  const chatId = selectedNode?.kind === 'chat' ? selectedNode.id : null
  const threadQuery = useChatThread(chatId)
  const [draft, setDraft] = useState('')
  const [sentMessages, setSentMessages] = useState<Message[]>([])

  const messages = useMemo(() => {
    const remoteMessages =
      threadQuery.data?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        status: message.status === 'working' ? 'working' as const : 'done' as const,
      })) ?? []
    const baselineMessages = remoteMessages.length > 0 ? remoteMessages : BASE_MESSAGES
    const activeMessages = [...baselineMessages, ...sentMessages]
    if (!selectedNode) return activeMessages
    return [
      {
        id: 'context',
        role: 'assistant' as const,
        body:
          selectedNode.kind === 'chat'
            ? `Loaded chat context: ${threadQuery.data?.title ?? selectedNode.name}`
            : `Working against selected ${selectedNode.kind}: ${selectedNode.name}`,
        status: 'done' as const,
      },
      ...activeMessages,
    ]
  }, [selectedNode, sentMessages, threadQuery.data])

  function appendDraft(body: string) {
    const trimmed = body.trim()
    if (!trimmed) return
    setSentMessages((current) => [
      ...current,
      { id: `local-user-${Date.now()}`, role: 'user', body: trimmed, status: 'done' },
      {
        id: `local-assistant-${Date.now()}`,
        role: 'assistant',
        body: 'Draft received locally. Backend send/run lifecycle will attach here.',
        status: 'working',
      },
    ])
    setDraft('')
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const composer = form.elements.namedItem('message')
    const body = composer && 'value' in composer ? String(composer.value) : draft
    appendDraft(body)
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background" aria-label="Chat">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Chip color="success" size="sm" variant="soft">
            Ready
          </Chip>
          <span className="truncate text-sm font-medium">
            {threadQuery.data?.title ?? selectedNode?.name ?? 'New thread'}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted">
          {threadQuery.isFetching ? 'Syncing' : threadQuery.data?.status ?? 'Stage chat'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <EmptyState title="No messages" description="Select a chat or app from Explorer." />
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((message) => (
              <li key={message.id} className="flex">
                <div
                  className={`max-w-[82%] rounded-large px-3 py-2 text-sm leading-5 shadow-sm ${roleClasses(message.role)}`}
                  data-chat-phase={message.status ?? 'done'}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-xs opacity-75">
                    <RoleIcon role={message.role} />
                    <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex shrink-0 items-end gap-2 border-t bg-content1 p-3"
        data-testid="island-chat-form"
      >
        <Button isIconOnly variant="ghost" size="sm" aria-label="Attach file">
          <Paperclip className="size-4" />
        </Button>
        <label className="sr-only" htmlFor="island-chat-composer">
          Message
        </label>
        <textarea
          id="island-chat-composer"
          name="message"
          data-testid="island-chat-composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={selectedNode ? `Message ${selectedNode.name}` : 'Message the agent'}
          rows={1}
          className="max-h-28 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="submit"
          isIconOnly
          variant="primary"
          size="sm"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  )
}
