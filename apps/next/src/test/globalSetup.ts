/**
 * Vitest globalSetup — runs once in the main thread before any test worker starts.
 *
 * Purpose: Node 25+ enables experimental web storage by default, which injects
 * a `globalThis.localStorage` object that does NOT implement the standard
 * Storage interface (no getItem/setItem). This causes Zustand stores that read
 * localStorage at module init time to throw before any setupFiles can patch it.
 *
 * This file is the only place to patch the issue reliably — it runs before
 * worker processes are spawned so the patched environment propagates to workers.
 */
export default function setup() {
  // Node 25's experimental localStorage is an object without Storage methods.
  // Replace it with a real in-memory implementation if needed.
  if (
    typeof globalThis.localStorage !== 'undefined' &&
    typeof globalThis.localStorage.getItem !== 'function'
  ) {
    const store: Record<string, string> = {}
    const storage: Storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { Object.keys(store).forEach((k) => { delete store[k] }) },
      get length() { return Object.keys(store).length },
      key: (i: number) => Object.keys(store)[i] ?? null,
    }
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
  }
}
