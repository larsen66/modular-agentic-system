/**
 * Stage — layout tests.
 *
 * Covers:
 *  - Default state (2 panes in row orient): both pane headers visible.
 *  - Single pane state: full-bleed (no divider, one header).
 *
 * The screen registry must be seeded before rendering Stage. We register lightweight
 * stub screens; no Supabase or real shell hooks involved.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { registerScreen } from '../screenRegistry'
import { useUiStore } from '@/state/uiStore'

// Register stub screens so Stage can resolve them.
function StubChat() {
  return <div data-testid="screen-chat">Chat stub</div>
}
function StubPreview() {
  return <div data-testid="screen-preview">Preview stub</div>
}

// Provide a minimal i18n context: the Stage + Pane read from useShellStrings().
// We mock the i18n module to return stable strings.
vi.mock('@/features/shell/i18n', () => ({
  useShellStrings: () => ({
    stage: {
      empty: { title: 'Nothing open', description: '' },
      pane: {
        chat: 'Chat',
        preview: 'Preview',
        dragHandle: 'Drag to rearrange',
        notRegistered: 'Screen not available',
      },
      divider: { label: 'Resize panes' },
    },
  }),
}))

// DndContext requires a pointer-events environment; jsdom supports this.
// We don't need to interact with drag in these tests.

// Lazily import Stage after mocks are set up.
import { Stage } from '../Stage'

describe('Stage', () => {
  beforeEach(() => {
    localStorage.clear()
    registerScreen('chat', StubChat)
    registerScreen('preview', StubPreview)
    // Reset stage to default: both panes, row orient
    useUiStore.setState({
      stage: { orient: 'row', order: ['chat', 'preview'], ratio: 0.5 },
    })
  })

  it('renders two pane headers in default row state', () => {
    render(<Stage />)
    // Pane header titles are rendered as <span> text inside the drag-handle header
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders both stub screen bodies in 2-pane mode', () => {
    render(<Stage />)
    expect(screen.getByTestId('screen-chat')).toBeInTheDocument()
    expect(screen.getByTestId('screen-preview')).toBeInTheDocument()
  })

  it('full-bleed with single pane: renders only the single screen body', () => {
    useUiStore.setState({
      stage: { orient: 'row', order: ['chat'], ratio: 0.5 },
    })
    render(<Stage />)
    expect(screen.getByTestId('screen-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('screen-preview')).toBeNull()
  })

  it('shows empty state when no panes are registered in order', () => {
    useUiStore.setState({
      stage: { orient: 'row', order: [], ratio: 0.5 },
    })
    render(<Stage />)
    expect(screen.getByText('Nothing open')).toBeInTheDocument()
  })
})
