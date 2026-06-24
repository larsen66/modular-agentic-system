// Chat pane host (design: docs/design/chat/screens/chat-pane.md, Variant A).
// Wires the transcript + composer to useChatRun for the active (chatId, sessionId). HeroUI v3 only;
// no custom CSS. v1 states: loading, empty, streaming, viewer, admission-rejection banner.

import { useEffect, useState } from 'react'
import { Card, Chip, Separator, Skeleton } from '@heroui/react'
import { Transcript } from '../message-list/Transcript'
import { Composer } from '../composer/Composer'
import { Selectors } from '../../components/composer/Selectors'
import { useChatRun } from '../../hooks/useChatRun'
import { useKernelRegistry } from '../../hooks/useKernelRegistry'
import type { ChatPaneScreenProps, ChatSelection, RejectionBanner } from '../../types'

export function ChatPaneScreen({ chatId, sessionId, readOnly = false }: ChatPaneScreenProps) {
  const run = useChatRun({ chatId, sessionId: sessionId ?? null })
  const { harnesses, environments } = useKernelRegistry()
  const [draft, setDraft] = useState('')
  const [rejection, setRejection] = useState<RejectionBanner | null>(null)
  const [selection, setSelection] = useState<ChatSelection>(() => {
    let saved: { harness?: string; environment?: string; topology?: string } = {}
    try { saved = JSON.parse(localStorage.getItem('kernel.selection') ?? '{}') } catch { /* ignore */ }
    // Model + agent + effort are fixed to 'auto' (omitted) — only harness × environment × topology
    // are user-selectable.
    return {
      agentModeId: 'auto',
      modelId: 'auto',
      effortId: 'medium',
      harness: saved.harness ?? 'opencode',
      environment: saved.environment ?? 'e2b',
      topology: saved.topology ?? 'agent-in-sandbox',
    }
  })
  // Persist the harness × environment × topology pick so it survives chat switches / reloads.
  useEffect(() => {
    try {
      localStorage.setItem('kernel.selection', JSON.stringify({ harness: selection.harness, environment: selection.environment, topology: selection.topology }))
    } catch { /* ignore */ }
  }, [selection.harness, selection.environment, selection.topology])

  async function handleSend() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setRejection(null)
    const harness = selection.harness && selection.harness !== 'auto' ? selection.harness : undefined
    const environment = selection.environment && selection.environment !== 'auto' ? selection.environment : undefined
    const topology = selection.topology && selection.topology !== 'auto' ? selection.topology : undefined
    const res = await run.send(text, { harness, environment, topology })
    if (res && res.kind !== 'accepted') {
      setDraft(text) // restore — never lose input
      setRejection({ code: res.kind === 'rejected' ? res.code : res.code, message: res.message })
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-pane">
      {run.loading ? (
        <div className="flex flex-1 flex-col gap-4 p-4" data-testid="chat-pane-loading">
          <Skeleton className="h-3 w-2/5 rounded-lg" />
          <Skeleton className="h-3 w-3/5 rounded-lg" />
          <Skeleton className="h-3 w-1/3 rounded-lg" />
        </div>
      ) : (
        <Transcript
          messages={run.messages}
          isStreaming={run.isStreaming}
          onAnswer={run.answer}
          onPermissionRespond={(id, action) => run.respondPermission(id, action as import('@/core/chat').PermissionAction)}
          onTopUp={() => { window.location.assign('/settings/billing') }}
        />
      )}

      {rejection && (
        <div className="px-3 pt-2" data-testid="chat-rejection">
          <Card>
            <Card.Header className="flex items-center gap-2">
              <Chip color="warning">{rejection.code}</Chip>
              <Card.Description>{rejection.message}</Card.Description>
            </Card.Header>
          </Card>
        </div>
      )}

      <Separator />
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={run.cancel}
        isStreaming={run.isStreaming}
        disabled={readOnly || !sessionId}
        provisioningHint={!sessionId ? 'Preparing your workspace…' : null}
        selectorSlot={<Selectors selection={selection} onChange={setSelection} harnesses={harnesses} environments={environments} disabled={readOnly} />}
      />
    </div>
  )
}
