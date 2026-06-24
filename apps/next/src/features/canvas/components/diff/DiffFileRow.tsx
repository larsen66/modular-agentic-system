import { Button, Chip, Disclosure } from '@heroui/react'
import { ChevronRight, FileCode } from 'lucide-react'
import { DiffFileBody } from './DiffFileBody'
import { useDiffStrings } from './diffStrings'
import type { DiffFileRowProps, RunDiffFileStatus } from '../../types/diff'

// One collapsible file row. HeroUI `Disclosure` owns the header (path + status Chip + ± Chips) and the
// collapse affordance; the `@pierre/diffs` body renders ONLY when expanded (lazy) so collapsed files
// cost zero highlight work (design §6 optimization). No accept/reject/apply — read-only (OPS owns
// governed apply). Expansion is controlled by the parent (collapse-all/expand-all) via `isExpanded`.

const STATUS_COLOR: Record<RunDiffFileStatus, 'success' | 'accent' | 'danger' | 'warning'> = {
  added: 'success',
  modified: 'accent',
  deleted: 'danger',
  renamed: 'warning',
}

export function DiffFileRow({ file, diffStyle, isExpanded }: DiffFileRowProps) {
  const t = useDiffStrings()
  const statusLabel = t.status[file.status]
  const displayPath = file.status === 'renamed' && file.prevPath ? `${file.prevPath} → ${file.path}` : file.path

  return (
    <Disclosure id={file.path} aria-label={file.path}>
      <Disclosure.Heading>
        <Button slot="trigger" variant={isExpanded ? 'secondary' : 'tertiary'} className="w-full">
          <Disclosure.Indicator>
            <ChevronRight className="size-4" />
          </Disclosure.Indicator>
          <FileCode className="size-4 text-muted" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">{displayPath}</span>
          {file.additions > 0 ? (
            <Chip size="sm" variant="soft" color="success">{`+${file.additions}`}</Chip>
          ) : null}
          {file.deletions > 0 ? (
            <Chip size="sm" variant="soft" color="danger">{`−${file.deletions}`}</Chip>
          ) : null}
          <Chip size="sm" variant="soft" color={STATUS_COLOR[file.status]} aria-label={statusLabel}>
            {statusLabel}
          </Chip>
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          {isExpanded ? <DiffFileBody file={file} diffStyle={diffStyle} /> : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  )
}
