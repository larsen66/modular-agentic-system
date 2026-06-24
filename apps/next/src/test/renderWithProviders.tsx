import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Render a component inside the providers a shell surface depends on. We build a FRESH QueryClient
// per render (retries off, no cache bleed between tests) rather than reusing the app singleton, so
// each test is isolated. I18n + Theme are driven by the cross-cutting uiStore (a module singleton),
// not a context, so tests set language/theme via the store directly when needed.
//
// Returns testing-library's result plus a pre-bound `user` (userEvent) for interaction tests.
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const queryClient = options.queryClient ?? makeTestQueryClient()
  const user = userEvent.setup()

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return {
    user,
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}
