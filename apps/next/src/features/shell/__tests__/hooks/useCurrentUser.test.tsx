import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeUser } from '@/test/factories'

vi.mock('@/core/session', () => ({
  getCurrentUser: vi.fn(),
  onAuthChange: vi.fn(),
}))
import { getCurrentUser, onAuthChange } from '@/core/session'
import { deriveInitials, useCurrentUser } from '@/features/shell/hooks/useCurrentUser'

const mockGet = vi.mocked(getCurrentUser)
const mockOnChange = vi.mocked(onAuthChange)

afterEach(() => {
  mockGet.mockReset()
  mockOnChange.mockReset()
})

describe('deriveInitials', () => {
  it('returns "?" for a null user', () => {
    expect(deriveInitials(null)).toBe('?')
  })

  it('uses the first two name parts, uppercased', () => {
    expect(deriveInitials(makeUser({ user_metadata: { full_name: 'Ada Lovelace' } }))).toBe('AL')
  })

  it('takes only the first two of three name parts', () => {
    expect(deriveInitials(makeUser({ user_metadata: { full_name: 'John Ronald Tolkien' } }))).toBe(
      'JR',
    )
  })

  it('handles a single-word name', () => {
    expect(deriveInitials(makeUser({ user_metadata: { full_name: 'Cher' } }))).toBe('C')
  })

  it('collapses extra whitespace between names', () => {
    expect(deriveInitials(makeUser({ user_metadata: { full_name: '  Ada   Lovelace  ' } }))).toBe(
      'AL',
    )
  })

  it('falls back to the first two email chars when no name', () => {
    expect(
      deriveInitials(makeUser({ user_metadata: {}, email: 'zoe@example.com' })),
    ).toBe('ZO')
  })

  it('falls back to email when full_name is blank/whitespace', () => {
    expect(
      deriveInitials(makeUser({ user_metadata: { full_name: '   ' }, email: 'bob@x.io' })),
    ).toBe('BO')
  })

  it('returns "?" when there is neither name nor email', () => {
    expect(deriveInitials(makeUser({ user_metadata: {}, email: undefined }))).toBe('?')
  })
})

describe('useCurrentUser', () => {
  it('starts loading, then resolves the signed-in user', async () => {
    const user = makeUser()
    mockGet.mockResolvedValue(user)
    mockOnChange.mockReturnValue(() => {})

    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(user)
  })

  it('resolves to null user but still clears loading when signed out', async () => {
    mockGet.mockResolvedValue(null)
    mockOnChange.mockReturnValue(() => {})

    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('updates when an auth change fires (sign-in after mount)', async () => {
    let emit: (u: ReturnType<typeof makeUser> | null) => void = () => {}
    mockGet.mockResolvedValue(null)
    mockOnChange.mockImplementation((cb) => {
      emit = cb
      return () => {}
    })

    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const next = makeUser({ email: 'new@example.com' })
    act(() => emit(next))
    await waitFor(() => expect(result.current.user).toEqual(next))
  })

  it('unsubscribes from auth changes on unmount', () => {
    const off = vi.fn()
    mockGet.mockResolvedValue(null)
    mockOnChange.mockReturnValue(off)

    const { unmount } = renderHook(() => useCurrentUser())
    unmount()
    expect(off).toHaveBeenCalledTimes(1)
  })
})
