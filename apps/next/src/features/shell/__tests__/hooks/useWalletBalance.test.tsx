import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '@/test/renderWithProviders'

// Mock the access-layer seam — the hook must never reach Supabase in a test.
vi.mock('@/core/billing', () => ({ fetchWalletBalance: vi.fn() }))
import { fetchWalletBalance } from '@/core/billing'
import { creditTone, useWalletBalance } from '@/features/shell/hooks/useWalletBalance'

const mockFetch = vi.mocked(fetchWalletBalance)

function wrapper() {
  const client = makeTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

afterEach(() => mockFetch.mockReset())

describe('creditTone', () => {
  it.each([
    [null, 'ok'],
    [undefined, 'ok'],
    [0, 'danger'],
    [4, 'danger'],
    [4.99, 'danger'],
    [5, 'warning'],
    [19, 'warning'],
    [19.99, 'warning'],
    [20, 'ok'],
    [1000, 'ok'],
    [-1, 'danger'],
  ] as const)('balance %s → %s', (balance, expected) => {
    expect(creditTone(balance)).toBe(expected)
  })
})

describe('useWalletBalance', () => {
  it('does not fetch while orgId is null (unconditional-call guard)', () => {
    renderHook(() => useWalletBalance(null), { wrapper: wrapper() })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fetch for an empty-string orgId', () => {
    renderHook(() => useWalletBalance(''), { wrapper: wrapper() })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches and returns the balance once an org is set', async () => {
    mockFetch.mockResolvedValue(42)
    const { result } = renderHook(() => useWalletBalance('org-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(42)
    expect(mockFetch).toHaveBeenCalledWith('org-1')
  })

  it('surfaces a zero balance as real data (not loading)', async () => {
    mockFetch.mockResolvedValue(0)
    const { result } = renderHook(() => useWalletBalance('org-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(0)
  })

  it('exposes an error when the seam throws', async () => {
    mockFetch.mockRejectedValue(new Error('rpc failed'))
    const { result } = renderHook(() => useWalletBalance('org-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
