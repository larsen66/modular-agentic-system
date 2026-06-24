/**
 * screenRegistry — register and get screens.
 *
 * Covers:
 *  - Registered component is returned by getScreen.
 *  - Unknown id returns undefined.
 *  - Re-registering same id overwrites (idempotent).
 *  - listScreens reflects insertion order.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ComponentType } from 'react'

vi.mock('@/core/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

import { registerScreen, getScreen, listScreens } from '../screenRegistry'
import '../registerScreens'
import { ThreadScreen } from '@/features/chat'
import { PreviewScreen } from '@/features/canvas'

// Stub components — plain functions, no JSX needed for registry tests.
const FooScreen: ComponentType = () => null
const BarScreen: ComponentType = () => null
const BazScreen: ComponentType = () => null

// The registry module is a shared singleton; clean up test registrations between tests
// by clearing the module-level Map via a workaround: we just use unique ids per test.
// (The Map is module-private so we rely on unique ids to avoid cross-test bleed.)
let counter = 0
function uid(prefix = 'screen') {
  return `${prefix}-${++counter}`
}

describe('screenRegistry', () => {
  it('registers island chat and preview screens at shell bootstrap', () => {
    expect(getScreen('chat')).toBe(ThreadScreen)
    expect(getScreen('preview')).toBe(PreviewScreen)
  })

  it('getScreen returns undefined for an unregistered id', () => {
    expect(getScreen(uid())).toBeUndefined()
  })

  it('getScreen returns the registered component after registerScreen', () => {
    const id = uid()
    registerScreen(id, FooScreen)
    expect(getScreen(id)).toBe(FooScreen)
  })

  it('re-registering the same id overwrites silently', () => {
    const id = uid()
    registerScreen(id, FooScreen)
    registerScreen(id, BarScreen)
    expect(getScreen(id)).toBe(BarScreen)
  })

  it('listScreens includes registered ids', () => {
    const id1 = uid('a')
    const id2 = uid('b')
    registerScreen(id1, FooScreen)
    registerScreen(id2, BazScreen)
    const screens = listScreens()
    expect(screens).toContain(id1)
    expect(screens).toContain(id2)
  })
})
