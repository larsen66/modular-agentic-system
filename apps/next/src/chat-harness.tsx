// Chat UI harness (DEV/TEST ONLY — Constitution VIII test-scaffolding exception). Drives the REAL
// chat components (Transcript + Composer) through the REAL runReducer with a SIMULATED stream, so
// Playwright (and visual iteration) can exercise every UI state without the backend/auth or the
// shell's (in-progress) Stage. NOT a shipped surface — not imported by the app entry.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Separator } from '@heroui/react'
import './index.css'
import { Transcript } from '@/features/chat/screens/message-list/Transcript'
import { Composer } from '@/features/chat/screens/composer/Composer'
import { Selectors } from '@/features/chat/components/composer/Selectors'
import { initialRunState, markPermissionDecided, reduceRunEvent, startOptimisticTurn } from '@/features/chat/lib/runReducer'
import type { ChatSelection, RunState } from '@/features/chat/types'

let n = 0
const id = () => `h${++n}`

function ChatHarness() {
  const [state, setState] = useState<RunState>(initialRunState)
  const [draft, setDraft] = useState('')
  const [selection, setSelection] = useState<ChatSelection>({ agentModeId: 'auto', modelId: 'auto', effortId: 'medium', harness: 'opencode', environment: 'e2b', topology: 'agent-in-sandbox' })

  function dispatch(eventType: string, data: unknown) {
    setState((prev) => reduceRunEvent(prev, { eventType, data: data as Record<string, unknown> | undefined }))
  }

  function send() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const runId = id()
    setState((prev) => startOptimisticTurn(prev, { userMessageId: id(), assistantMessageId: id(), text, runId, createdAt: '', }))
    // Simulated stream: start → reasoning → todos → tool calls → text → complete.
    setTimeout(() => dispatch('start', { runId, model: 'gpt-5.5', provider: 'openai' }), 100)
    setTimeout(() => dispatch('progress', { reasoning: 'Plan: scaffold, then wire the API.' }), 250)
    setTimeout(() => dispatch('progress', { todoItems: [{ content: 'scaffold app', status: 'in_progress' }, { content: 'wire API', status: 'pending' }] }), 400)
    setTimeout(() => dispatch('progress', { tool: 'write', callID: 'c1', toolState: 'running', file: 'src/App.tsx' }), 600)
    setTimeout(() => dispatch('progress', { tool: 'write', callID: 'c1', toolState: 'completed', file: 'src/App.tsx', content: 'created App.tsx (42 lines)' }), 900)
    setTimeout(() => dispatch('progress', { delta: 'Working on it — scaffolding the app…' }), 1050)
    setTimeout(() => dispatch('complete', { success: true, runId }), 1300)
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center gap-2 p-2" data-testid="harness-controls">
        <span className="text-sm text-muted-foreground">Harness:</span>
        <Button size="sm" variant="ghost" onPress={() => dispatch('error', { code: 'model_unavailable', error: 'down' })}>inject error</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('question', { prompt: 'Which framework — React or Vue?' })}>inject question</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('permission', { permissionId: 'p1', permissionKind: 'write', toolName: 'edit', filePath: 'src/App.tsx' })}>inject permission</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('human_handoff_requested', { status: 'pending_bridge', handoff_id: 'h1' })}>inject handoff</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('error', { code: 'insufficient_balance' })}>inject balance</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('git_persistence', { status: 'commit_succeeded_push_succeeded' })}>inject git</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('model_failover_applied', { requestedModel: { provider: 'openai', model: 'gpt-5.5' }, actualModel: { provider: 'anthropic', model: 'claude-opus-4-8' }, reason: 'quarantine' })}>inject failover</Button>
        <Button size="sm" variant="ghost" onPress={() => dispatch('verification', { visualVerification: { status: 'failed' } })}>inject verify</Button>
        <Button size="sm" variant="ghost" onPress={() => setState(initialRunState())}>reset</Button>
      </div>
      <Separator />
      <Transcript
        messages={state.messages}
        isStreaming={state.isStreaming}
        onAnswer={(a) => dispatch('progress', { delta: `\n(answered: ${a})` })}
        onPermissionRespond={(_id, action) => setState((prev) => markPermissionDecided(prev, action as 'allow_once' | 'allow' | 'deny'))}
        onTopUp={() => dispatch('progress', { delta: '\n(top up clicked)' })}
      />
      <Separator />
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={() => dispatch('complete', { success: false, runId: 'x', phase: 'cancelled' })}
        isStreaming={state.isStreaming}
        onAttachFiles={() => {}}
        onToggleVoice={() => {}}
        onToggleElementPicker={() => {}}
        selectorSlot={<Selectors selection={selection} onChange={setSelection} />}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><ChatHarness /></StrictMode>,
)
