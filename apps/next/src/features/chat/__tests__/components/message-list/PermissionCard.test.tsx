import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PermissionCard } from '@/features/chat/components/message-list/PermissionCard'

describe('PermissionCard', () => {
  it('shows the request and routes allow/deny to onRespond', async () => {
    const onRespond = vi.fn()
    render(<PermissionCard permission={{ permissionId: 'p1', permissionKind: 'write', toolName: 'edit', filePath: 'app.tsx' }} onRespond={onRespond} />)
    expect(screen.getByTestId('permission-card')).toHaveTextContent('edit')
    expect(screen.getByTestId('permission-card')).toHaveTextContent('app.tsx')
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }))
    expect(onRespond).toHaveBeenCalledWith('allow')
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(onRespond).toHaveBeenCalledWith('deny')
    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    expect(onRespond).toHaveBeenCalledWith('allow_once')
  })

  it('shows the resolved outcome once decided (no action buttons)', () => {
    render(<PermissionCard permission={{ permissionId: 'p1', permissionKind: 'write', decided: 'deny' }} />)
    const card = screen.getByTestId('permission-card')
    expect(card).toHaveAttribute('data-decided', 'deny')
    expect(card).toHaveTextContent('Denied')
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull()
  })
})
