import { create } from 'zustand'
import type { AgentMode, ModelMode } from '@/core/chat'

// Model / agent / effort selection state for the composer. Recreated island-side from the legacy
// chatConfigStore (the two-switch omission contract lives in core/chat.buildRunSelection). Defaults
// match legacy: Auto model, explicit Plan-Code agent, low effort.

const LS_KEY = 'island-chat-selection-v2'

export interface ModelRef {
  provider: string
  model: string
}

/** The existing app a landing-state chat should start in (else a new app is bootstrapped). */
export interface LandingTarget {
  projectId: string
  workspaceId: string
  label: string
}

interface SelectionState {
  modelMode: ModelMode
  explicitModelRef: ModelRef | null
  agentMode: AgentMode
  selectedAgentId: string
  effortId: string
  /** Kernel run target — the harness × environment × topology triple ('auto' → the kernel's own default). */
  harness: string
  environment: string
  topology: string
  /** Ephemeral (not persisted): which app the landing composer targets; null → new app. */
  landingTarget: LandingTarget | null
  pickModel: (ref: ModelRef) => void
  clearModel: () => void
  pickAgent: (id: string) => void
  clearAgent: () => void
  setEffort: (id: string) => void
  setHarness: (id: string) => void
  setEnvironment: (id: string) => void
  setTopology: (id: string) => void
  setLandingTarget: (target: LandingTarget | null) => void
}

interface Persisted {
  modelMode: ModelMode
  explicitModelRef: ModelRef | null
  agentMode: AgentMode
  selectedAgentId: string
  effortId: string
  harness: string
  environment: string
  topology: string
}

// The composer exposes ONLY the harness × environment × topology selectors; model and agent are
// fixed to 'auto' (omitted from the run so the kernel falls back to its own default).
const DEFAULTS: Persisted = {
  modelMode: 'auto',
  explicitModelRef: null,
  agentMode: 'auto',
  selectedAgentId: 'sisyphus',
  effortId: 'medium',
  harness: 'opencode',
  environment: 'e2b',
  topology: 'agent-in-sandbox',
}

function read(): Persisted {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    return DEFAULTS
  }
}

function persist(state: Persisted): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export const useSelectionStore = create<SelectionState>((set, get) => {
  const save = () => {
    const s = get()
    persist({
      modelMode: s.modelMode,
      explicitModelRef: s.explicitModelRef,
      agentMode: s.agentMode,
      selectedAgentId: s.selectedAgentId,
      effortId: s.effortId,
      harness: s.harness,
      environment: s.environment,
      topology: s.topology,
    })
  }
  return {
    ...read(),
    landingTarget: null,
    setLandingTarget: (target) => set({ landingTarget: target }),
    pickModel: (ref) => {
      set({ modelMode: 'explicit', explicitModelRef: ref })
      save()
    },
    clearModel: () => {
      set({ modelMode: 'auto', explicitModelRef: null })
      save()
    },
    pickAgent: (id) => {
      set({ agentMode: 'explicit', selectedAgentId: id })
      save()
    },
    clearAgent: () => {
      set({ agentMode: 'auto' })
      save()
    },
    setEffort: (id) => {
      set({ effortId: id })
      save()
    },
    setHarness: (id) => {
      set({ harness: id })
      save()
    },
    setEnvironment: (id) => {
      set({ environment: id })
      save()
    },
    setTopology: (id) => {
      set({ topology: id })
      save()
    },
  }
})
