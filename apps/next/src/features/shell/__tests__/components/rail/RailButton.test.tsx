import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { RailButton } from '@/features/shell/components/rail/RailButton'

const icon = <svg data-testid="icon" />

describe('RailButton', () => {
  it('renders an accessible icon button with the given aria-label', () => {
    renderWithProviders(<RailButton icon={icon} label="Explorer" aria-label="Explorer" />)
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('fires onPress when clicked', async () => {
    const onPress = vi.fn()
    const { user } = renderWithProviders(
      <RailButton icon={icon} label="Files" aria-label="Files" onPress={onPress} />,
    )
    await user.click(screen.getByRole('button', { name: 'Files' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire onPress when disabled', async () => {
    const onPress = vi.fn()
    const { user } = renderWithProviders(
      <RailButton icon={icon} label="People" aria-label="People" isDisabled onPress={onPress} />,
    )
    const btn = screen.getByRole('button', { name: 'People' })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('reflects the active state via aria-pressed-independent variant (still one button)', () => {
    const { rerender } = renderWithProviders(
      <RailButton icon={icon} label="History" aria-label="History" active={false} />,
    )
    const inactive = screen.getByRole('button', { name: 'History' }).className
    rerender(<RailButton icon={icon} label="History" aria-label="History" active />)
    const active = screen.getByRole('button', { name: 'History' }).className
    // Active state is expressed as a different HeroUI variant → a different class signature.
    expect(active).not.toEqual(inactive)
  })
})
