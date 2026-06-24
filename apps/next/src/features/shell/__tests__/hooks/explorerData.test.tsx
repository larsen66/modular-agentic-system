import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '@/test/renderWithProviders'

vi.mock('@/core/explorer', () => ({ fetchProjects: vi.fn(), fetchProjectChats: vi.fn() }))
import { fetchProjects, fetchProjectChats } from '@/core/explorer'
import { useProjects } from '@/features/shell/hooks/useProjects'
import { useProjectChats } from '@/features/shell/hooks/useProjectChats'

const mockProjects = vi.mocked(fetchProjects)
const mockChats = vi.mocked(fetchProjectChats)

function wrapper() {
  const client = makeTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

afterEach(() => {
  mockProjects.mockReset()
  mockChats.mockReset()
})

describe('useProjects (lazy on expand)', () => {
  it('does not fetch without a workspace id', () => {
    renderHook(() => useProjects(null), { wrapper: wrapper() })
    expect(mockProjects).not.toHaveBeenCalled()
  })

  it('does not fetch while the branch is collapsed (enabled=false)', () => {
    renderHook(() => useProjects('ws-1', false), { wrapper: wrapper() })
    expect(mockProjects).not.toHaveBeenCalled()
  })

  it('fetches once the branch expands', async () => {
    mockProjects.mockResolvedValue([
      { id: 'a1', name: 'App', icon: null, entityType: 'app', updatedAt: null },
    ])
    const { result } = renderHook(() => useProjects('ws-1', true), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockProjects).toHaveBeenCalledWith('ws-1')
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useProjectChats (lazy on expand)', () => {
  it('does not fetch without a project id', () => {
    renderHook(() => useProjectChats(null), { wrapper: wrapper() })
    expect(mockChats).not.toHaveBeenCalled()
  })

  it('does not fetch while disabled', () => {
    renderHook(() => useProjectChats('p-1', null, false), { wrapper: wrapper() })
    expect(mockChats).not.toHaveBeenCalled()
  })

  it('fetches with the project + host workspace', async () => {
    mockChats.mockResolvedValue([])
    const { result } = renderHook(() => useProjectChats('p-1', 'ws-1', true), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockChats).toHaveBeenCalledWith('p-1', 'ws-1')
  })
})
