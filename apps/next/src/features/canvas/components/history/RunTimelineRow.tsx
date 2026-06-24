import { Chip } from '@heroui/react'
import { useUiStore } from '@/state/uiStore'
import { useCanvasStrings } from '../../i18n'
import type { RunTimelineRowProps } from '../../types/history'
import { statusChipColor, bucketChipColor, formatRunTime } from './runFormat'

// One timeline row: "Run #N" + timestamp, a status Chip, a files-changed ± Chip, and (only when the
// run produced a governed proposal) a proposal-state Chip so the user sees at a glance which runs are
// reachable in OPS. Rendered inside a ListBox.Item via Label/Description. NO custom CSS.

export function RunTimelineRow({ run, index }: RunTimelineRowProps) {
  const t = useCanvasStrings()
  const lang = useUiStore((s) => s.language)

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t.history.runLabel} #{index}
        </span>
        <Chip size="sm" color={statusChipColor(run.status)}>
          {t.history.status[run.status]}
        </Chip>
      </div>
      <span className="text-xs text-muted">{formatRunTime(run.createdAt, lang)}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Chip size="sm" variant="soft">
          {t.history.filesSummary(run.filesChanged, run.additions, run.deletions)}
        </Chip>
        {run.proposalId ? (
          <Chip size="sm" variant="soft" color={bucketChipColor(run.proposalBucket)}>
            {t.history.bucket[run.proposalBucket]}
          </Chip>
        ) : null}
      </div>
    </div>
  )
}
