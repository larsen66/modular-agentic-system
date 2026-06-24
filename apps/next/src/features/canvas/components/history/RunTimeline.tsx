import { ListBox, ScrollShadow, Label } from '@heroui/react'
import type { Selection } from '@heroui/react'
import { useCanvasStrings } from '../../i18n'
import type { RunTimelineProps } from '../../types/history'
import { RunTimelineRow } from './RunTimelineRow'

// The run timeline (left region) — a single-selection ListBox over the project's runs (newest-first).
// There is NO Timeline/List primitive in HeroUI v3 (verified) — the timeline is composed from
// ListBox + ListBox.Item per the design. Scroll-capped via ScrollShadow. NO custom CSS.

export function RunTimeline({ runs, selectedRunId, onSelect }: RunTimelineProps) {
  const t = useCanvasStrings()

  const handleSelectionChange = (keys: Selection) => {
    if (keys === 'all') return
    const first = Array.from(keys)[0]
    if (first != null) onSelect(String(first))
  }

  return (
    <ScrollShadow className="max-h-full min-h-0 flex-1">
      <ListBox
        aria-label={t.history.timelineLabel}
        selectionMode="single"
        selectedKeys={selectedRunId ? new Set([selectedRunId]) : new Set()}
        onSelectionChange={handleSelectionChange}
        className="w-full"
      >
        {runs.map((run, i) => (
          <ListBox.Item key={run.id} id={run.id} textValue={`${t.history.runLabel} ${runs.length - i}`}>
            <Label className="w-full">
              <RunTimelineRow run={run} index={runs.length - i} />
            </Label>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    </ScrollShadow>
  )
}
