import { Button, Chip, Separator, ToggleButton, ToggleButtonGroup, Tooltip } from '@heroui/react'
import { Columns2, Rows3 } from 'lucide-react'
import { useDiffStrings } from './diffStrings'
import type { DiffHeaderProps, DiffStyle } from '../../types/diff'

// The diff header strip — "N files changed" + Σ± stats + unified/split toggle + collapse/expand-all.
// Pure HeroUI chrome (no custom CSS): Chip stats, ToggleButtonGroup for the per-screen diff-style
// preference, a tertiary Button for collapse-all. On compact width split needs more room than there
// is, so it's forced to unified and the split option is disabled with an explanatory Tooltip.

export function DiffHeader({
  fileCount,
  totalAdditions,
  totalDeletions,
  diffStyle,
  onDiffStyleChange,
  allExpanded,
  onToggleAll,
  compact = false,
}: DiffHeaderProps) {
  const t = useDiffStrings()

  return (
    <div className="flex flex-wrap items-center gap-2 p-2">
      <Chip size="sm" variant="soft">{t.filesChanged(fileCount)}</Chip>
      {totalAdditions > 0 ? (
        <Chip size="sm" variant="soft" color="success">{`+${totalAdditions}`}</Chip>
      ) : null}
      {totalDeletions > 0 ? (
        <Chip size="sm" variant="soft" color="danger">{`−${totalDeletions}`}</Chip>
      ) : null}

      <div className="flex flex-1 items-center justify-end gap-2">
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([compact ? 'unified' : diffStyle])}
          onSelectionChange={(keys) => {
            const next = [...keys][0] as DiffStyle | undefined
            if (next) onDiffStyleChange(next)
          }}
        >
          <ToggleButton id="unified" aria-label={t.unified}>
            <Rows3 className="size-4" />
            {t.unified}
          </ToggleButton>
          <ToggleButton id="split" aria-label={t.split} isDisabled={compact}>
            <ToggleButtonGroup.Separator />
            {compact ? (
              <Tooltip>
                <Tooltip.Trigger>
                  <span className="flex items-center gap-1">
                    <Columns2 className="size-4" />
                    {t.split}
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content>{t.splitNeedsWidth}</Tooltip.Content>
              </Tooltip>
            ) : (
              <>
                <Columns2 className="size-4" />
                {t.split}
              </>
            )}
          </ToggleButton>
        </ToggleButtonGroup>

        <Separator orientation="vertical" className="h-5" />

        <Button variant="tertiary" size="sm" onPress={onToggleAll}>
          {allExpanded ? t.collapseAll : t.expandAll}
        </Button>
      </div>
    </div>
  )
}
