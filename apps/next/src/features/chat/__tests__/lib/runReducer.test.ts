import { describe, expect, it } from 'vitest'
import { initialRunState, markPermissionDecided, reduceRunEvent, startOptimisticTurn } from '@/features/chat/lib/runReducer'
import type { RunState, RunStreamEvent } from '@/features/chat/types'

const ev = (eventType: string, data: unknown): RunStreamEvent => ({ eventType, data: data as Record<string, unknown> | undefined })

function withTurn(): RunState {
  return startOptimisticTurn(initialRunState(), {
    userMessageId: 'u1', assistantMessageId: 'a1', text: 'build a todo app', runId: 'r1', createdAt: '2026-06-13T00:00:00Z',
  })
}

describe('startOptimisticTurn', () => {
  it('appends a complete user row + pending assistant row, enters dispatching/streaming', () => {
    const s = withTurn()
    expect(s.phase).toBe('dispatching')
    expect(s.runId).toBe('r1')
    expect(s.isStreaming).toBe(true)
    expect(s.messages.map((m) => [m.role, m.status])).toEqual([['user', 'complete'], ['assistant', 'pending']])
    expect(s.messages[0].text).toBe('build a todo app')
  })
})

describe('reduceRunEvent', () => {
  it('start → preparing, attaches model chip to the active assistant row', () => {
    const s = reduceRunEvent(withTurn(), ev('start', { runId: 'r1', model: 'gpt-5.5', provider: 'openai' }))
    expect(s.phase).toBe('preparing')
    const a = s.messages[1]
    expect(a.status).toBe('streaming')
    expect(a.model).toBe('gpt-5.5')
  })

  it('progress accumulates text deltas and moves to streaming', () => {
    let s = reduceRunEvent(withTurn(), ev('start', { runId: 'r1' }))
    s = reduceRunEvent(s, ev('progress', { delta: 'Hello' }))
    s = reduceRunEvent(s, ev('progress', { delta: ', world' }))
    expect(s.phase).toBe('streaming')
    expect(s.messages[1].text).toBe('Hello, world')
    expect(s.isStreaming).toBe(true)
  })

  it('run_snapshot ignores stale (lower-version) snapshots', () => {
    let s = reduceRunEvent(withTurn(), ev('run_snapshot', { runId: 'r1', phase: 'streaming', version: 5 }))
    expect(s.version).toBe(5)
    s = reduceRunEvent(s, ev('run_snapshot', { runId: 'r1', phase: 'preparing', version: 3 })) // stale
    expect(s.phase).toBe('streaming')
    expect(s.version).toBe(5)
  })

  it('run_snapshot terminal phase clears isStreaming', () => {
    const s = reduceRunEvent(withTurn(), ev('run_snapshot', { runId: 'r1', phase: 'settled_success', version: 9 }))
    expect(s.isStreaming).toBe(false)
  })

  it('question → waiting_input and attaches the prompt to the assistant row', () => {
    const s = reduceRunEvent(withTurn(), ev('question', { prompt: 'Which framework?', options: ['React', 'Vue'] }))
    expect(s.phase).toBe('waiting_input')
    expect(s.messages[1].question).toEqual({ prompt: 'Which framework?', options: ['React', 'Vue'] })
  })

  it('complete (success) flips terminal: isStreaming false, assistant complete, git status captured', () => {
    let s = reduceRunEvent(withTurn(), ev('progress', { delta: 'done' }))
    s = reduceRunEvent(s, ev('complete', { success: true, runId: 'r1', gitPersistence: { status: 'commit_succeeded_push_succeeded' } }))
    expect(s.phase).toBe('settled_success')
    expect(s.isStreaming).toBe(false)
    expect(s.messages[1].status).toBe('complete')
    expect(s.messages[1].gitStatus).toBe('commit_succeeded_push_succeeded')
  })

  it('error sets errorCode + error status and flips terminal', () => {
    const s = reduceRunEvent(withTurn(), ev('error', { code: 'model_unavailable', error: 'down' }))
    expect(s.phase).toBe('settled_error')
    expect(s.isStreaming).toBe(false)
    expect(s.messages[1].errorCode).toBe('model_unavailable')
    expect(s.messages[1].status).toBe('error')
  })

  it('clarification_required surfaces as an interactive question, not a dead error', () => {
    const s = reduceRunEvent(withTurn(), ev('error', { code: 'clarification_required', metadata: { intent_label: 'add auth' } }))
    expect(s.phase).toBe('waiting_input')
    expect(s.messages[1].question?.prompt).toContain('add auth')
    expect(s.messages[1].status).toBe('streaming')
  })

  it('progress with a tool call upserts it by callID (running → completed)', () => {
    let s = reduceRunEvent(withTurn(), ev('progress', { tool: 'edit', callID: 't1', toolState: 'running', file: 'app.tsx' }))
    expect(s.messages[1].toolCalls).toEqual([{ callID: 't1', tool: 'edit', toolState: 'running', file: 'app.tsx', content: undefined, delegationState: undefined }])
    s = reduceRunEvent(s, ev('progress', { tool: 'edit', callID: 't1', toolState: 'completed', content: 'patched' }))
    expect(s.messages[1].toolCalls).toHaveLength(1)
    expect(s.messages[1].toolCalls![0]).toMatchObject({ callID: 't1', toolState: 'completed', content: 'patched' })
  })

  it('progress with a toolCalls snapshot array merges all by callID', () => {
    const s = reduceRunEvent(withTurn(), ev('progress', { toolCalls: [
      { tool: 'read', callID: 'a', toolState: 'completed' },
      { tool: 'bash', callID: 'b', toolState: 'running' },
    ] }))
    expect(s.messages[1].toolCalls?.map((t) => t.callID)).toEqual(['a', 'b'])
  })

  it('progress with todos + reasoning populates the assistant row', () => {
    let s = reduceRunEvent(withTurn(), ev('progress', { todoItems: [{ content: 'scaffold', status: 'completed' }, { content: 'wire api', status: 'in_progress' }] }))
    s = reduceRunEvent(s, ev('progress', { reasoning: 'Planning the build' }))
    expect(s.messages[1].todoItems).toEqual([{ content: 'scaffold', status: 'completed' }, { content: 'wire api', status: 'in_progress' }])
    expect(s.messages[1].reasoning).toBe('Planning the build')
  })

  it('complete finalizes still-running tool calls to completed', () => {
    let s = reduceRunEvent(withTurn(), ev('progress', { tool: 'bash', callID: 'b', toolState: 'running' }))
    s = reduceRunEvent(s, ev('complete', { success: true, runId: 'r1' }))
    expect(s.messages[1].toolCalls![0].toolState).toBe('completed')
  })

  it('permission event attaches a permission request with patterns', () => {
    const s = reduceRunEvent(withTurn(), ev('permission', { permissionId: 'p1', permissionKind: 'write', toolName: 'edit', filePath: 'app.tsx', patterns: ['app.tsx'] }))
    expect(s.messages[1].permission).toMatchObject({ permissionId: 'p1', permissionKind: 'write', toolName: 'edit', patterns: ['app.tsx'] })
  })

  it('markPermissionDecided records the user decision optimistically', () => {
    const s = reduceRunEvent(withTurn(), ev('permission', { permissionId: 'p1', permissionKind: 'write' }))
    const decided = markPermissionDecided(s, 'allow')
    expect(decided.messages[1].permission?.decided).toBe('allow')
  })

  it('git_persistence event attaches the save status to the active row', () => {
    const s = reduceRunEvent(withTurn(), ev('git_persistence', { status: 'commit_succeeded_push_succeeded', runId: 'r1' }))
    expect(s.messages[1].gitStatus).toBe('commit_succeeded_push_succeeded')
  })

  it('complete carries gitPersistence.status onto the row', () => {
    const s = reduceRunEvent(withTurn(), ev('complete', { success: true, runId: 'r1', gitPersistence: { status: 'commit_failed' } }))
    expect(s.messages[1].gitStatus).toBe('commit_failed')
  })

  it('human_handoff_requested attaches a handoff notice', () => {
    const s = reduceRunEvent(withTurn(), ev('human_handoff_requested', { status: 'pending_bridge', handoff_id: 'h1' }))
    expect(s.messages[1].handoff).toEqual({ status: 'pending_bridge' })
    expect(s.messages[1].status).toBe('complete')
  })

  it('model_failover_applied attaches a failover notice', () => {
    const s = reduceRunEvent(withTurn(), ev('model_failover_applied', {
      requestedModel: { provider: 'openai', model: 'gpt-5.5' },
      actualModel: { provider: 'anthropic', model: 'claude-opus-4-8' },
      reason: 'quarantine',
    }))
    expect(s.messages[1].failover).toEqual({ requested: 'gpt-5.5', actual: 'claude-opus-4-8', reason: 'quarantine' })
  })

  it('verification attaches a visual-verification notice only when not passed', () => {
    const failed = reduceRunEvent(withTurn(), ev('verification', { visualVerification: { status: 'failed' } }))
    expect(failed.messages[1].visualVerification).toEqual({ status: 'failed' })
    expect(failed.phase).toBe('verifying')
    const passed = reduceRunEvent(withTurn(), ev('verification', { visualVerification: { status: 'passed' } }))
    expect(passed.messages[1].visualVerification).toBeUndefined()
  })

  it('unknown event names pass through unchanged (name-agnostic)', () => {
    const before = withTurn()
    const after = reduceRunEvent(before, ev('task_size_classified', { size: 'L' }))
    expect(after).toEqual(before)
  })
})
