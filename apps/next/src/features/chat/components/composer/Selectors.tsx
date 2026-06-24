// Selectors row (design: docs/design/chat/screens/composer.md §3 + legacy/selectors.md).
// v1 minimalist: the kernel's signature run target — harness × environment × topology. Model, agent
// mode and effort selectors were removed; runs omit those so the kernel uses its own defaults.
// Harness + environment options come from the live project registry (GET /registry); topology is the
// fixed agent-loop placement set. Mounted into the Composer via `selectorSlot`.

import { ListBox, Select } from '@heroui/react'
import type { SelectorsProps } from '../../types'

const TOPOLOGIES = [
  { id: 'agent-in-sandbox', label: 'In-sandbox' },
  { id: 'agent-as-tool', label: 'As-tool' },
]

// Always include the current pick so the trigger never renders blank before the registry loads.
function withCurrent(current: string | undefined, refs: string[], fallback: string): string[] {
  const cur = current ?? fallback
  return refs.includes(cur) ? refs : [cur, ...refs]
}

export function Selectors({ selection, onChange, harnesses = [], environments = [], disabled = false }: SelectorsProps) {
  const harnessIds = withCurrent(selection.harness, harnesses, 'opencode')
  const envIds = withCurrent(selection.environment, environments, 'e2b')

  return (
    <>
      {/* Kernel run target — the signature harness × environment × topology selection (GET /registry). */}
      <Select
        aria-label="Harness"
        className="w-[170px]"
        isDisabled={disabled}
        value={selection.harness ?? 'opencode'}
        onChange={(value) => value != null && onChange({ ...selection, harness: String(value) })}
        data-testid="selector-harness"
      >
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {harnessIds.map((h) => (
              <ListBox.Item key={h} id={h} textValue={h}>
                {h}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        aria-label="Environment"
        className="w-[150px]"
        isDisabled={disabled}
        value={selection.environment ?? 'e2b'}
        onChange={(value) => value != null && onChange({ ...selection, environment: String(value) })}
        data-testid="selector-environment"
      >
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {envIds.map((e) => (
              <ListBox.Item key={e} id={e} textValue={e}>
                {e}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        aria-label="Topology"
        className="w-[150px]"
        isDisabled={disabled}
        value={selection.topology ?? 'agent-in-sandbox'}
        onChange={(value) => value != null && onChange({ ...selection, topology: String(value) })}
        data-testid="selector-topology"
      >
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {TOPOLOGIES.map((tpl) => (
              <ListBox.Item key={tpl.id} id={tpl.id} textValue={tpl.label}>
                {tpl.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </>
  )
}
