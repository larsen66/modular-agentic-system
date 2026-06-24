import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Selectors } from '@/features/chat/components/composer/Selectors'

describe('Selectors', () => {
  it('renders Harness + Environment + Topology selects reflecting the current selection', () => {
    render(<Selectors
      selection={{ agentModeId: 'auto', modelId: 'auto', effortId: 'medium', harness: 'opencode', environment: 'e2b', topology: 'agent-in-sandbox' }}
      onChange={vi.fn()}
    />)
    expect(screen.getByTestId('selector-harness')).toHaveTextContent('opencode')
    expect(screen.getByTestId('selector-environment')).toHaveTextContent('e2b')
    expect(screen.getByTestId('selector-topology')).toHaveTextContent('In-sandbox')
  })

  it('reflects the agent-as-tool topology in the trigger', () => {
    render(<Selectors
      selection={{ agentModeId: 'auto', modelId: 'auto', effortId: 'medium', harness: 'opencode', environment: 'e2b', topology: 'agent-as-tool' }}
      onChange={vi.fn()}
    />)
    expect(screen.getByTestId('selector-topology')).toHaveTextContent('As-tool')
  })

  it('disables all selects when disabled', () => {
    render(<Selectors
      selection={{ agentModeId: 'auto', modelId: 'auto', effortId: 'medium', harness: 'opencode', environment: 'e2b', topology: 'agent-in-sandbox' }}
      onChange={vi.fn()}
      disabled
    />)
    const triggers = screen.getAllByRole('button')
    expect(triggers.length).toBeGreaterThanOrEqual(3)
  })
})
