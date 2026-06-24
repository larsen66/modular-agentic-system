// Terminal/notice surfaces inside an assistant turn (mined: src/components/Chat/
// {InsufficientBalanceCard,GitPersistenceIndicator}.tsx + shared/chat-events.ts git status set).
// Minimalist HeroUI v3 (Card/Chip/Button). Data-shape-light by design: the rich balance figures +
// the remaining notice types (materialize/failover/launch/partial-recovery) are phase 2 (notices.md).

import { Button, Card, Chip } from '@heroui/react'
import { SHARED_SAVED_TO_GITHUB_STATUSES } from '@shared/chat-events'
import { useChatStrings } from '../../i18n'

/** Map a git-persistence status to a chip (saved / partial / failed). Skipped/none → null. */
export function GitStatusChip({ status }: { status: string }) {
  const t = useChatStrings()
  if (SHARED_SAVED_TO_GITHUB_STATUSES.has(status as never)) {
    return <Chip color="success" data-testid="git-status" data-status={status}>{t.notices.savedToGithub}</Chip>
  }
  if (status === 'commit_succeeded_push_failed' || status === 'commit_failed') {
    return <Chip color="danger" data-testid="git-status" data-status={status}>{t.notices.saveFailed}</Chip>
  }
  if (status === 'blocked_preexisting_dirty_overlap' || status === 'pending_push') {
    return <Chip color="warning" data-testid="git-status" data-status={status}>{t.notices.savePending}</Chip>
  }
  return null // skipped_* / pending — nothing to surface
}

/** Model-failover notice — the run swapped the requested model for a healthy one. */
export function FailoverNotice({ requested, actual, reason }: { requested: string; actual: string; reason: string }) {
  const t = useChatStrings()
  return (
    <div className="flex items-center gap-2" data-testid="failover-notice">
      <Chip color="warning">{t.notices.modelSwitched}</Chip>
      <span className="text-sm text-muted-foreground">
        {requested} → {actual} · {t.notices.failoverReason[reason] ?? reason}
      </span>
    </div>
  )
}

/** Visual-verification notice — the run's design check did not pass (non-blocking, role=status). */
export function VisualVerificationNotice({ status }: { status: string }) {
  const t = useChatStrings()
  return (
    <div className="flex items-center gap-2" role="status" data-testid="visual-verification" data-status={status}>
      <Chip color="warning">{t.notices.visualCheck}</Chip>
      <span className="text-sm text-muted-foreground">{t.notices.visualCheckBody} ({status}).</span>
    </div>
  )
}

/** Insufficient-balance surface (replaces the generic error row for `insufficient_balance`). */
export function InsufficientBalanceCard({ onTopUp, onRetry }: { onTopUp?: () => void; onRetry?: () => void }) {
  const t = useChatStrings()
  return (
    <Card data-testid="insufficient-balance">
      <Card.Header>
        <Card.Title>{t.notices.outOfCredits}</Card.Title>
        <Card.Description>{t.notices.outOfCreditsBody}</Card.Description>
      </Card.Header>
      <Card.Footer className="flex gap-2">
        <Button onPress={() => onTopUp?.()}>{t.notices.topUp}</Button>
        {onRetry && <Button variant="secondary" onPress={() => onRetry()}>{t.notices.tryAgain}</Button>}
      </Card.Footer>
    </Card>
  )
}
