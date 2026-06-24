import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '@/test/renderWithProviders'

vi.mock('@/core/referral', () => ({
  fetchReferralCode: vi.fn(),
  fetchReferralUsageCount: vi.fn(),
}))
import { fetchReferralCode, fetchReferralUsageCount } from '@/core/referral'
import { useReferral } from '@/features/shell/hooks/useReferral'

const mockCode = vi.mocked(fetchReferralCode)
const mockUsage = vi.mocked(fetchReferralUsageCount)

function wrapper() {
  const client = makeTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

afterEach(() => {
  mockCode.mockReset()
  mockUsage.mockReset()
})

describe('useReferral', () => {
  it('builds the invite link from the code against window.origin', async () => {
    mockCode.mockResolvedValue('ABC123')
    mockUsage.mockResolvedValue(0)
    const { result } = renderHook(() => useReferral('user-1', 'org-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.code).toBe('ABC123'))
    // jsdom default origin is http://localhost:3000
    expect(result.current.link).toBe(`${window.location.origin}/?ref=ABC123`)
  })

  it('keeps link null until the code resolves', () => {
    mockCode.mockReturnValue(new Promise(() => {})) // never resolves → loading
    mockUsage.mockResolvedValue(0)
    const { result } = renderHook(() => useReferral('user-1', 'org-1'), { wrapper: wrapper() })

    expect(result.current.link).toBeNull()
    expect(result.current.code).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('does not fetch the code without BOTH userId and orgId', () => {
    mockUsage.mockResolvedValue(0)
    renderHook(() => useReferral('user-1', null), { wrapper: wrapper() })
    expect(mockCode).not.toHaveBeenCalled()
  })

  it('fetches usage on userId alone (org not required)', async () => {
    mockUsage.mockResolvedValue(7)
    const { result } = renderHook(() => useReferral('user-1', null), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.usageCount).toBe(7))
    expect(mockUsage).toHaveBeenCalledWith('user-1')
  })

  it('defaults usageCount to 0 before it resolves', () => {
    mockCode.mockResolvedValue('X')
    mockUsage.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useReferral('user-1', 'org-1'), { wrapper: wrapper() })

    expect(result.current.usageCount).toBe(0)
  })

  it('passes both ids through to the code RPC', async () => {
    mockCode.mockResolvedValue('CODE')
    mockUsage.mockResolvedValue(0)
    renderHook(() => useReferral('user-9', 'org-9'), { wrapper: wrapper() })

    await waitFor(() => expect(mockCode).toHaveBeenCalledWith('user-9', 'org-9'))
  })
})
