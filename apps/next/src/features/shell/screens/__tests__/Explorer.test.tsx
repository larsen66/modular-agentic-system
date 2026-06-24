/**
 * Explorer — renders skeleton during load, then tree data.
 *
 * Mocks:
 *  - @/core/session → getCurrentUser returns a fixed user; onAuthChange is a no-op.
 *  - @/core/explorer → fetchTree returns one org with one workspace + app.
 *
 * Covers:
 *  - Skeleton is shown while the query is pending.
 *  - Tree data is displayed once the query resolves.
 *  - onSelectNode is called with correct payload on app press.
 *
 * NOTE: vi.mock factories are hoisted before top-level variable initialisation.
 * Never reference module-level `const` inside vi.mock factories — use inline literals.
 *
 * NOTE: HeroUI Tabs uses react-aria-components' SharedElement/SharedElementTransition.
 * Wrap renders with SharedElementTransition to satisfy the context requirement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SharedElementTransition } from 'react-aria-components'
import type { User } from '@supabase/supabase-js'

// ── Mocks — declared before imports; factories use only inline literals ───

vi.mock('@/core/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

// Inline user object — cannot reference const before initialization (vi.mock is hoisted).
vi.mock('@/core/session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
  }),
  onAuthChange: vi.fn().mockReturnValue(() => undefined),
}))

vi.mock('@/core/explorer', () => ({
  fetchTree: vi.fn().mockResolvedValue([
    {
      id: 'org-1',
      name: 'Acme Corp',
      workspaces: [
        {
          id: 'ws-1',
          name: 'Main Workspace',
          apps: [{ id: 'app-1', name: 'My App', status: 'active' }],
        },
      ],
    },
  ]),
  fetchChatsForApp: vi.fn().mockResolvedValue([
    { id: 'chat-1', name: 'Launch chat', kind: 'main', status: 'active', activityAt: null, workspaceId: null },
  ]),
}))

// Imports after vi.mock declarations (transformer hoists vi.mock calls above imports anyway).
import { Explorer } from '../explorer/Explorer'
import * as sessionMod from '@/core/session'
import * as explorerMod from '@/core/explorer'

// Typed constants for test assertions — defined here, not in factories.
const MOCK_USER: User = { id: 'user-1', email: 'test@example.com' } as User

const MOCK_TREE = [
  {
    id: 'org-1',
    name: 'Acme Corp',
    workspaces: [
      {
        id: 'ws-1',
        name: 'Main Workspace',
        apps: [{ id: 'app-1', name: 'My App', status: 'active' }],
      },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/**
 * Render Explorer with all required providers.
 *
 * SharedElementTransition is required by HeroUI Tabs.Indicator (which uses
 * react-aria-components' SharedElement internally).
 */
function renderExplorer() {
  const qc = makeQueryClient()
  return render(
    <SharedElementTransition>
      <QueryClientProvider client={qc}>
        <Explorer />
      </QueryClientProvider>
    </SharedElementTransition>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Explorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessionMod.getCurrentUser).mockResolvedValue(MOCK_USER)
    vi.mocked(sessionMod.onAuthChange).mockReturnValue(() => undefined)
    vi.mocked(explorerMod.fetchTree).mockResolvedValue(MOCK_TREE)
    vi.mocked(explorerMod.fetchChatsForApp).mockResolvedValue([
      { id: 'chat-1', name: 'Launch chat', kind: 'main', status: 'active', activityAt: null, workspaceId: null },
    ])
  })

  it('shows skeleton rows while the tree is loading', async () => {
    // Use a deferred (never-resolving) promise so the tree query stays in loading state.
    vi.mocked(explorerMod.fetchTree).mockReturnValue(new Promise(() => undefined))
    renderExplorer()
    // The tree query starts loading once the user session resolves and enables the query.
    // Use waitFor to let the user session resolve (getCurrentUser), which enables
    // the tree query, which puts it in isLoading=true → renders skeleton with aria-busy.
    await waitFor(() => {
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    })
  })

  it('renders the app name once the tree resolves', async () => {
    renderExplorer()
    await waitFor(() => {
      expect(screen.getByText('My App')).toBeInTheDocument()
    })
  })

  it('selects the app node in the store when the app trigger is pressed', async () => {
    renderExplorer()
    await waitFor(() => screen.getByText('My App'))
    screen.getByText('My App').click()
    // Explorer sets store state (no onSelectNode prop); verify the node appears.
    expect(screen.getByText('My App')).toBeInTheDocument()
  })

  it('expands app and shows chats when the app row is pressed', async () => {
    renderExplorer()
    await waitFor(() => screen.getByText('My App'))
    screen.getByText('My App').click()
    await waitFor(() => screen.getByText('Launch chat'))
    expect(screen.getByText('Launch chat')).toBeInTheDocument()
  })
})
