// Vitest global setup. jsdom + testing-library matchers + per-test cleanup, plus the browser
// APIs HeroUI / React-Aria reach for that jsdom doesn't implement (matchMedia, ResizeObserver,
// IntersectionObserver, pointer-capture, scrollIntoView, clipboard). Without these, opening a
// Popover/Modal/Dropdown throws in jsdom. Real assertions still drive the components — these are
// only inert shims for environment gaps.
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// matchMedia — read by resolveTheme('system') and React-Aria responsive hooks.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// ResizeObserver / IntersectionObserver — React-Aria overlays observe their triggers.
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver
globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver

// Pointer capture + scrollIntoView — React-Aria press/overlay code calls these on elements.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Clipboard — InviteCopyAction / ReferralLink copy the invite link. Default to a resolving stub;
// individual tests can spy on it.
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  })
}
