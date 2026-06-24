import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ExplorerEmptyState } from '@/features/shell/components/explorer/ExplorerEmptyState'

describe('ExplorerEmptyState', () => {
  it('shows the message', () => {
    renderWithProviders(<ExplorerEmptyState message="No workspaces yet" />)
    expect(screen.getByText('No workspaces yet')).toBeInTheDocument()
  })

  it('shows no retry button by default', () => {
    renderWithProviders(<ExplorerEmptyState message="Empty" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a retry that fires onRetry', async () => {
    const onRetry = vi.fn()
    const { user } = renderWithProviders(
      <ExplorerEmptyState message="Failed" onRetry={onRetry} retryLabel="Retry" />,
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
