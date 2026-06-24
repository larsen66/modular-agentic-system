// Model catalog hook — fetches the session-independent /models/catalog once and caches in module
// scope (the catalog is stable across a session). Plain fetch (no react-query) so it works in the
// pane AND the dev harness. Returns available models first; empty until loaded.

import { useEffect, useState } from 'react'
import { fetchModelCatalog, type ModelOption } from '@/core/chat'

let cache: ModelOption[] | null = null
let inflight: Promise<ModelOption[]> | null = null

export function useModelCatalog(): { models: ModelOption[]; loading: boolean } {
  const [models, setModels] = useState<ModelOption[]>(cache ?? [])
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    if (cache) return
    let cancelled = false
    inflight ??= fetchModelCatalog().catch(() => [])
    inflight.then((rows) => {
      cache = rows
      if (!cancelled) { setModels(rows); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return { models, loading }
}
