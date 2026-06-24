import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Transcript } from '@/features/chat/screens/message-list/Transcript'
import type { ChatMessage } from '@/features/chat/types'

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm', role: 'assistant', text: '', status: 'complete', createdAt: '', ...over,
})

describe('Transcript', () => {
  it('shows the empty state when there are no messages', () => {
    render(<Transcript messages={[]} />)
    expect(screen.getByTestId('transcript-empty')).toBeInTheDocument()
  })

  it('renders user and assistant rows in order', () => {
    render(<Transcript messages={[
      msg({ id: 'u', role: 'user', text: 'build a todo app' }),
      msg({ id: 'a', role: 'assistant', text: 'On it.', model: 'gpt-5.5' }),
    ]} />)
    expect(screen.getByTestId('message-user')).toHaveTextContent('build a todo app')
    const a = screen.getByTestId('message-assistant')
    expect(a).toHaveTextContent('On it.')
    expect(a).toHaveTextContent('gpt-5.5')
  })

  it('shows a streaming spinner on a streaming assistant row', () => {
    render(<Transcript messages={[msg({ id: 'a', status: 'streaming', text: 'working' })]} />)
    expect(screen.getByLabelText('Generating')).toBeInTheDocument()
  })

  it('renders an error row carrying the error code', () => {
    render(<Transcript messages={[msg({ id: 'a', status: 'error', errorCode: 'model_unavailable' })]} />)
    expect(screen.getByTestId('message-error')).toHaveTextContent('model_unavailable')
  })

  it('renders a pending question and routes the answer to onAnswer', async () => {
    const onAnswer = vi.fn()
    render(<Transcript onAnswer={onAnswer} messages={[
      msg({ id: 'a', status: 'streaming', question: { prompt: 'Which framework?' } }),
    ]} />)
    expect(screen.getByTestId('message-question')).toHaveTextContent('Which framework?')
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'React')
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(onAnswer).toHaveBeenCalledWith('React')
  })
})
