import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { EXPLORER_DEFAULT_WIDTH, EXPLORER_MIN_WIDTH, useUiStore } from '@/state/uiStore'
import { en } from '@/features/shell/i18n/en'
import { ExplorerResizer } from '@/features/shell/components/explorer/ExplorerResizer'

beforeEach(() => useUiStore.setState({ explorerWidth: EXPLORER_DEFAULT_WIDTH }))

describe('ExplorerResizer', () => {
  it('exposes an accessible separator with the current width', () => {
    renderWithProviders(<ExplorerResizer />)
    const sep = screen.getByRole('separator', { name: en.explorer.resize })
    expect(sep).toHaveAttribute('aria-valuenow', String(EXPLORER_DEFAULT_WIDTH))
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('nudges the width with the arrow keys', async () => {
    const { user } = renderWithProviders(<ExplorerResizer />)
    const sep = screen.getByRole('separator', { name: en.explorer.resize })
    sep.focus()
    await user.keyboard('{ArrowRight}')
    expect(useUiStore.getState().explorerWidth).toBe(EXPLORER_DEFAULT_WIDTH + 16)
    await user.keyboard('{ArrowLeft}')
    expect(useUiStore.getState().explorerWidth).toBe(EXPLORER_DEFAULT_WIDTH)
  })

  it('clamps at the minimum when nudged repeatedly left', async () => {
    useUiStore.setState({ explorerWidth: EXPLORER_MIN_WIDTH + 8 })
    const { user } = renderWithProviders(<ExplorerResizer />)
    screen.getByRole('separator', { name: en.explorer.resize }).focus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(useUiStore.getState().explorerWidth).toBe(EXPLORER_MIN_WIDTH)
  })
})
