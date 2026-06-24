import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Island owns its own QueryClient — server-state cache cannot cross the React 18↔19 boundary,
// so the legacy app's client is never shared. All server data is fetched through src/core/**.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
