import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'

describe('DegradedStatePanel', () => {
  it('renders title + description', () => {
    renderWithProviders(<DegradedStatePanel title="This session ended" description="It was reclaimed." />)
    expect(screen.getByText('This session ended')).toBeInTheDocument()
    expect(screen.getByText('It was reclaimed.')).toBeInTheDocument()
  })

  it('fires the primary action', async () => {
    const onAction = vi.fn()
    renderWithProviders(<DegradedStatePanel title="Error" actionLabel="Retry" onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('renders a secondary action alongside the primary', () => {
    renderWithProviders(
      <DegradedStatePanel
        title="Error"
        actionLabel="Retry"
        onAction={() => {}}
        secondaryActionLabel="Restart"
        onSecondaryAction={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
  })

  it('renders no buttons when no action is given', () => {
    renderWithProviders(<DegradedStatePanel title="No preview yet" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
