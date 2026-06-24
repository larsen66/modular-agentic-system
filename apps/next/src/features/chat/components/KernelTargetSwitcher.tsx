import { ModeSelector } from '@/components/agent-elements/input/mode-selector'
import { useSelectionStore } from '../state/selectionStore'
import { useKernelRegistry } from '../hooks/useKernelRegistry'

// The kernel's signature control: the only run selectors the composer exposes — harness ×
// environment × topology. Harness + environment are populated from the live project registry
// (GET /registry); topology picks WHERE the agent loop runs relative to the sandbox. Wired to the
// selection store so useChat threads the pick into the run's POST /message body.
const TOPOLOGY_MODES = [
  { id: 'agent-in-sandbox', label: 'In-sandbox' },
  { id: 'agent-as-tool', label: 'As-tool' },
]

export function KernelTargetSwitcher() {
  const harness = useSelectionStore((s) => s.harness)
  const environment = useSelectionStore((s) => s.environment)
  const topology = useSelectionStore((s) => s.topology)
  const setHarness = useSelectionStore((s) => s.setHarness)
  const setEnvironment = useSelectionStore((s) => s.setEnvironment)
  const setTopology = useSelectionStore((s) => s.setTopology)
  const { harnesses, environments } = useKernelRegistry()

  // Always show the current pick even if the registry hasn't loaded yet (or omits it), so the
  // selector never renders empty.
  const harnessModes = uniqueModes(harness, harnesses)
  const envModes = uniqueModes(environment, environments)

  return (
    <>
      <ModeSelector modes={harnessModes} value={harness} onChange={setHarness} />
      <ModeSelector modes={envModes} value={environment} onChange={setEnvironment} />
      <ModeSelector modes={TOPOLOGY_MODES} value={topology} onChange={setTopology} />
    </>
  )
}

function uniqueModes(current: string, refs: string[]): { id: string; label: string }[] {
  const ids = refs.includes(current) ? refs : [current, ...refs]
  return ids.map((id) => ({ id, label: id }))
}
