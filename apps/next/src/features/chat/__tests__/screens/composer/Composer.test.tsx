import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from '@/features/chat/screens/composer/Composer'

function setup(overrides: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const props = {
    value: '', onChange: vi.fn(), onSend: vi.fn(), onStop: vi.fn(),
    ...overrides,
  }
  render(<Composer {...props} />)
  return props
}

describe('Composer', () => {
  it('disables Send when empty and enables it with text', () => {
    setup({ value: '' })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    render(<Composer value="hi" onChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Send message' }).at(-1)).toBeEnabled()
  })

  it('calls onSend when Send is pressed with text', async () => {
    const props = setup({ value: 'build it' })
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(props.onSend).toHaveBeenCalledOnce()
  })

  it('sends on Enter, inserts newline on Shift+Enter', async () => {
    const props = setup({ value: 'build it' })
    const ta = screen.getByRole('textbox', { name: 'Message' })
    ta.focus()
    await userEvent.keyboard('{Enter}')
    expect(props.onSend).toHaveBeenCalledOnce()
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(props.onSend).toHaveBeenCalledOnce() // not called again
  })

  it('shows Stop (not Send) while streaming and calls onStop', async () => {
    const props = setup({ value: '', isStreaming: true })
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Stop generation' }))
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('renders attachment chips with a remove control', async () => {
    const onRemoveAttachment = vi.fn()
    render(<Composer value="" onChange={vi.fn()} onSend={vi.fn()} attachments={[{ id: 'f1', name: 'logo.png' }]} onRemoveAttachment={onRemoveAttachment} />)
    expect(screen.getByText('logo.png')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove logo.png' }))
    expect(onRemoveAttachment).toHaveBeenCalledWith('f1')
  })

  it('renders the attach affordance only when a handler is provided', () => {
    const { rerender } = render(<Composer value="" onChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Attach files' })).toBeNull()
    rerender(<Composer value="" onChange={vi.fn()} onSend={vi.fn()} onAttachFiles={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeInTheDocument()
  })

  it('disables the input + Send when disabled (viewer)', () => {
    setup({ value: 'x', disabled: true })
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })
})
