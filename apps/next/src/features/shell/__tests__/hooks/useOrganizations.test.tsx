import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '@/test/renderWithProviders'
import { makeOrg } from '@/test/factories'

vi.mock('@/core/orgs', () => ({ fetchOrganizations: vi.fn() }))
import { fetchOrganizations } from '@/core/orgs'
import { useOrganizations } from '@/features/shell/hooks/useOrganizations'

const mockFetch = vi.mocked(fetchOrganizations)

function wrapper() {
  const client = makeTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

afterEach(() => mockFetch.mockReset())

describe('useOrganizations', () => {
  it('stays disabled until a userId is present', () => {
    renderHook(() => useOrganizations(null), { wrapper: wrapper() })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('stays disabled for undefined userId', () => {
    renderHook(() => useOrganizations(undefined), { wrapper: wrapper() })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches the membership-scoped orgs for a user', async () => {
    const orgs = [makeOrg({ name: 'Acme' }), makeOrg({ name: 'Globex' })]
    mockFetch.mockResolvedValue(orgs)
    const { result } = renderHook(() => useOrganizations('user-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(orgs)
    expect(mockFetch).toHaveBeenCalledWith('user-1')
  })

  it('returns an empty list when the user belongs to no orgs', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useOrganizations('user-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('reports an error when the seam rejects', async () => {
    mockFetch.mockRejectedValue(new Error('rls denied'))
    const { result } = renderHook(() => useOrganizations('user-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
