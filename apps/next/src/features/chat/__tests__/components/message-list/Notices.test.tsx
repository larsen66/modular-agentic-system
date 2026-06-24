import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FailoverNotice, GitStatusChip, InsufficientBalanceCard, VisualVerificationNotice } from '@/features/chat/components/message-list/Notices'

describe('GitStatusChip', () => {
  it('shows "Saved to GitHub" for a pushed status', () => {
    render(<GitStatusChip status="commit_succeeded_push_succeeded" />)
    expect(screen.getByTestId('git-status')).toHaveTextContent('Saved to GitHub')
  })
  it('shows "Save failed" for a failed push', () => {
    render(<GitStatusChip status="commit_succeeded_push_failed" />)
    expect(screen.getByTestId('git-status')).toHaveTextContent('Save failed')
  })
  it('renders nothing for a skipped status', () => {
    const { container } = render(<GitStatusChip status="skipped_no_changes" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('FailoverNotice', () => {
  it('shows the requested→actual swap and a human reason', () => {
    render(<FailoverNotice requested="gpt-5.5" actual="claude-opus-4-8" reason="quarantine" />)
    const n = screen.getByTestId('failover-notice')
    expect(n).toHaveTextContent('gpt-5.5 → claude-opus-4-8')
    expect(n).toHaveTextContent('temporarily unhealthy')
  })
})

describe('VisualVerificationNotice', () => {
  it('renders a status notice with role=status', () => {
    render(<VisualVerificationNotice status="failed" />)
    const n = screen.getByTestId('visual-verification')
    expect(n).toHaveAttribute('role', 'status')
    expect(n).toHaveTextContent('failed')
  })
})

describe('InsufficientBalanceCard', () => {
  it('renders the out-of-credits prompt and routes Top up', async () => {
    const onTopUp = vi.fn()
    render(<InsufficientBalanceCard onTopUp={onTopUp} />)
    expect(screen.getByTestId('insufficient-balance')).toHaveTextContent('Out of credits')
    await userEvent.click(screen.getByRole('button', { name: 'Top up' }))
    expect(onTopUp).toHaveBeenCalledOnce()
  })
})
