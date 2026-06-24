import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { NodeRow } from '@/features/shell/components/explorer/NodeRow'

const icon = <svg data-testid="icon" />

describe('NodeRow', () => {
  it('renders one button named by its label', () => {
    renderWithProviders(<NodeRow icon={icon} label="Checkout" />)
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('exposes aria-expanded for branch rows', () => {
    const { rerender } = renderWithProviders(
      <NodeRow icon={icon} label="Sales" expanded={false} />,
    )
    expect(screen.getByRole('button', { name: 'Sales' })).toHaveAttribute('aria-expanded', 'false')
    rerender(<NodeRow icon={icon} label="Sales" expanded />)
    expect(screen.getByRole('button', { name: 'Sales' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('omits aria-expanded for leaf rows', () => {
    renderWithProviders(<NodeRow icon={icon} label="A chat" />)
    expect(screen.getByRole('button', { name: 'A chat' })).not.toHaveAttribute('aria-expanded')
  })

  it('fires onPress when clicked', async () => {
    const onPress = vi.fn()
    const { user } = renderWithProviders(<NodeRow icon={icon} label="App" onPress={onPress} />)
    await user.click(screen.getByRole('button', { name: 'App' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('reflects selection via a different variant', () => {
    const { rerender } = renderWithProviders(<NodeRow icon={icon} label="App" selected={false} />)
    const unselected = screen.getByRole('button', { name: 'App' }).className
    rerender(<NodeRow icon={icon} label="App" selected />)
    expect(screen.getByRole('button', { name: 'App' }).className).not.toEqual(unselected)
  })
})
