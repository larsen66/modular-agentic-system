import { useCallback, useState } from 'react'

// User-pinned models for the composer's model picker. Pins are COSMETIC — they float a model to the
// top of the list, they do NOT change dispatch (legacy invariant: pin gestures are single-writer and
// never touch the selected/default model). Persisted in localStorage (the island's client-pref
// pattern, like uiStore); cross-device Supabase sync (legacy `user_preferences.pinned_models`) can
// layer on later behind the same hook API. Ids match the model-option ids the ModelSwitcher builds
// (`<provider>::<model>`); the `auto` pseudo-option is never pinnable.
const KEY = 'island-pinned-models'

function readPins(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writePins(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* storage full / disabled — pins are best-effort, never block the UI */
  }
}

export function usePinnedModels() {
  const [pinned, setPinned] = useState<string[]>(readPins)

  const toggle = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      writePins(next)
      return next
    })
  }, [])

  return { pinned, toggle }
}
