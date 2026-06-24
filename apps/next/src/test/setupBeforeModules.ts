/**
 * Vitest setupFiles — this file runs in the test worker context BEFORE test modules
 * are evaluated, making it suitable for patching globals that module-level code depends on.
 *
 * Problem: Node 25+ experimental web storage provides globalThis.localStorage as an
 * object without standard Storage methods (no getItem/setItem). Vitest's jsdom environment
 * sets global.window = jsdom.window but jsdom's localStorage property may be shadowed by
 * the Node experimental Storage on some Node/jsdom version combinations.
 *
 * Fix: replace window.localStorage (and globalThis.localStorage) with a proper in-memory
 * Storage implementation before any module code runs.
 */

// Replace localStorage if it's missing the standard Storage API.
function makeInMemoryStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k] }) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

function patchStorage() {
  const storage = makeInMemoryStorage()

  // Patch globalThis.localStorage
  if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  }

  // Patch window.localStorage if window is separate from globalThis
  if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  }

  // Also patch sessionStorage in the same way
  if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.getItem !== 'function') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: makeInMemoryStorage(),
      writable: true,
      configurable: true,
    })
  }
}

patchStorage()

export {}
