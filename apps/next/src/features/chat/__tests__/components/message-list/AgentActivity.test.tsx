import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentActivity } from '@/features/chat/components/message-list/AgentActivity'
import type { ChatMessage } from '@/features/chat/types'

const base: ChatMessage = { id: 'a', role: 'assistant', text: '', status: 'streaming', createdAt: '' }

describe('AgentActivity', () => {
  it('renders nothing when there is no activity', () => {
    const { container } = render(<AgentActivity message={base} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders tool calls with name, status, file and output', () => {
    render(<AgentActivity message={{ ...base, toolCalls: [
      { callID: 't1', tool: 'edit', toolState: 'completed', file: 'app.tsx', content: 'patched 3 lines' },
    ] }} />)
    const row = screen.getByTestId('tool-call')
    expect(row).toHaveAttribute('data-tool', 'edit')
    expect(row).toHaveAttribute('data-state', 'completed')
    expect(row).toHaveTextContent('app.tsx')
    expect(row).toHaveTextContent('patched 3 lines')
  })

  it('labels a child-session delegation as "Sub-agent"', () => {
    render(<AgentActivity message={{ ...base, toolCalls: [
      { callID: 't1', tool: 'task', toolState: 'running', delegationState: 'child_session' },
    ] }} />)
    expect(screen.getByTestId('tool-call')).toHaveTextContent('Sub-agent')
  })

  it('renders a todo plan with per-item status', () => {
    render(<AgentActivity message={{ ...base, todoItems: [
      { content: 'scaffold', status: 'completed' },
      { content: 'wire api', status: 'in_progress' },
    ] }} />)
    const items = screen.getAllByTestId('todo-item')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAttribute('data-status', 'completed')
    expect(items[0]).toHaveTextContent('scaffold')
  })

  it('renders reasoning and modified files', () => {
    render(<AgentActivity message={{ ...base, reasoning: 'thinking…', modifiedFiles: ['a.ts', 'b.ts'] }} />)
    expect(screen.getByTestId('reasoning')).toHaveTextContent('thinking…')
    expect(screen.getByTestId('modified-files')).toHaveTextContent('a.ts')
    expect(screen.getByTestId('modified-files')).toHaveTextContent('b.ts')
  })
})
