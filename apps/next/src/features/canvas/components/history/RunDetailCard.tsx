import { Card, Chip, Button, Alert, Separator } from '@heroui/react'
import { GitCompare, ExternalLink } from 'lucide-react'
import { useUiStore } from '@/state/uiStore'
import { useCanvasStrings } from '../../i18n'
import type { RunDetailCardProps } from '../../types/history'
import { RunFilesTable } from './RunFilesTable'
import { statusChipColor, bucketChipColor, formatRunTime } from './runFormat'

// The selected-run detail (right region): metadata (status/model/time/session) + files table + the
// deep-link CTAs. READ-ONLY — "View diff" deep-links to the canvas diff view, "Open in OPS" to the
// governed proposal; a load-bearing honesty Alert states nothing is applied or rolled back from here
// (C16). NO in-canvas apply/rollback. HeroUI components + semantic tokens only.

export function RunDetailCard({ detail, onViewDiff, onOpenInOps }: RunDetailCardProps) {
  const t = useCanvasStrings()
  const lang = useUiStore((s) => s.language)

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Card.Title>{t.history.detail.title}</Card.Title>
          <Chip size="sm" color={statusChipColor(detail.status)}>
            {t.history.status[detail.status]}
          </Chip>
          {detail.proposalId ? (
            <Chip size="sm" variant="soft" color={bucketChipColor(detail.proposalBucket)}>
              {t.history.bucket[detail.proposalBucket]}
            </Chip>
          ) : null}
        </div>
        <Card.Description>
          {t.history.detail.metaLine(formatRunTime(detail.createdAt, lang), detail.model ?? t.history.detail.unknownModel)}
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        <div className="flex flex-wrap items-center gap-1">
          <Chip size="sm" variant="soft">
            {t.history.filesSummary(detail.files.length, detail.additions, detail.deletions)}
          </Chip>
          {detail.sessionId ? (
            <Chip size="sm" variant="soft">
              {t.history.detail.session}: {detail.sessionId}
            </Chip>
          ) : null}
        </div>

        <Separator />

        <RunFilesTable files={detail.files} />

        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t.history.honesty.title}</Alert.Title>
            <Alert.Description>{t.history.honesty.description}</Alert.Description>
          </Alert.Content>
        </Alert>
      </Card.Content>

      <Card.Footer>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onPress={onViewDiff}
            isDisabled={!onViewDiff || detail.files.length === 0}
          >
            <GitCompare className="size-4" />
            {t.history.actions.viewDiff}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={onOpenInOps}
            isDisabled={!detail.proposalId}
          >
            <ExternalLink className="size-4" />
            {t.history.actions.openInOps}
          </Button>
        </div>
      </Card.Footer>
    </Card>
  )
}
