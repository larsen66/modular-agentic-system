import { useEffect, useState } from 'react'
import { Skeleton, Separator, Spinner } from '@heroui/react'
import { AlertTriangle, History } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { buildOpsProposalPath } from '@/core/history'
import { useCanvasStrings } from '../../i18n'
import { RunTimeline } from '../../components/history/RunTimeline'
import { RunDetailCard } from '../../components/history/RunDetailCard'
import { HistoryEmptyState } from '../../components/history/HistoryEmptyState'
import type { HistoryScreenProps } from '../../types/history'
import { useRunList, useRunDetail } from './useRunHistory'

// The history screen — a READ-ONLY master/detail run-history timeline for the active app node. Left:
// the run timeline (ListBox). Right: the selected-run detail (Card) with files table + deep-link CTAs.
// It NEVER applies or rolls back — "View diff" deep-links the canvas diff view, "Open in OPS" the
// governed proposal; apply/rollback is OPS-domain (C16). Composition only (ARCHITECTURE §3). NO custom CSS.

export function HistoryScreen({ projectId, chatId, onViewDiff, onOpenInOps }: HistoryScreenProps) {
  const t = useCanvasStrings()
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const list = useRunList(projectId, chatId)
  const detail = useRunDetail(selectedRunId)

  // Auto-select the newest run once the async list lands (keeps the detail panel useful by default) —
  // a selection that depends on fetched data, so it's set after the data arrives, not derivable.
  useEffect(() => {
    if (!selectedRunId && list.data && list.data.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRunId(list.data[0].id)
    }
  }, [list.data, selectedRunId])

  // No project context → shared degraded/no-session panel (matches preview/child-mount empties).
  if (!projectId) {
    return (
      <DegradedStatePanel
        icon={<History className="size-8" />}
        title={t.history.noSession.title}
        description={t.history.noSession.description}
      />
    )
  }

  if (list.isLoading) {
    return (
      <div className="flex h-full min-h-0">
        <div className="flex w-72 flex-col gap-3 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <Separator orientation="vertical" />
        <div className="flex flex-1 flex-col gap-3 p-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (list.isError) {
    return (
      <DegradedStatePanel
        icon={<AlertTriangle className="size-8" />}
        tone="danger"
        title={t.history.error.title}
        description={t.history.error.description}
        actionLabel={t.history.error.action}
        onAction={() => list.refetch()}
      />
    )
  }

  const runs = list.data ?? []
  if (runs.length === 0) return <HistoryEmptyState />

  const handleOpenInOps = () => {
    if (!detail.data?.proposalId) return
    if (onOpenInOps) onOpenInOps(detail.data.proposalId)
    else window.location.assign(buildOpsProposalPath(detail.data.proposalId))
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <div className="flex min-h-0 w-full flex-col p-2 md:w-72">
        <RunTimeline runs={runs} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />
      </div>

      <Separator orientation="vertical" className="hidden md:block" />
      <Separator className="md:hidden" />

      <div className="flex min-h-0 flex-1 flex-col p-2">
        {detail.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : detail.isError ? (
          <DegradedStatePanel
            icon={<AlertTriangle className="size-8" />}
            tone="danger"
            title={t.history.error.title}
            description={t.history.error.description}
            actionLabel={t.history.error.action}
            onAction={() => detail.refetch()}
          />
        ) : detail.data ? (
          <RunDetailCard
            detail={detail.data}
            onViewDiff={onViewDiff ? () => onViewDiff(detail.data!.id) : undefined}
            onOpenInOps={handleOpenInOps}
          />
        ) : (
          <DegradedStatePanel
            icon={<History className="size-8" />}
            title={t.history.detail.emptyHint.title}
            description={t.history.detail.emptyHint.description}
          />
        )}
      </div>
    </div>
  )
}
