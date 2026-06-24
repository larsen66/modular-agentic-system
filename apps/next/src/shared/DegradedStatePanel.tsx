import type { ReactNode } from 'react'
import { Button } from '@heroui/react'

// Shared widget — the one panel every non-ready preview state renders through (canvas
// `preview-lifecycle` flow: provisioning / evicted / router-upgrade / container-dead / error /
// no-session, and reused by `child-app-mount`). A centered icon + title + description + optional
// recovery action. HeroUI Button + semantic tokens + structural layout only (NO custom CSS); the
// final visual treatment is refined against the owner's design references.

export interface DegradedStatePanelProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Primary recovery action (Retry / Restart / Start new chat). */
  actionLabel?: string
  onAction?: () => void
  /** Secondary action (e.g. Restart alongside Retry on the error state). */
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  /** Emphasis → HeroUI semantic tone (not a bespoke color). */
  tone?: 'muted' | 'warning' | 'danger'
  /** Busy (e.g. while a retry is in flight) → disables + shows pending on the primary action. */
  busy?: boolean
}

const TITLE_TONE: Record<NonNullable<DegradedStatePanelProps['tone']>, string> = {
  muted: 'text-foreground',
  warning: 'text-warning',
  danger: 'text-danger',
}

export function DegradedStatePanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = 'muted',
  busy = false,
}: DegradedStatePanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {icon ? <div className="text-muted">{icon}</div> : null}
        <p className={`text-sm font-medium ${TITLE_TONE[tone]}`}>{title}</p>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
        {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
          <div className="mt-1 flex items-center gap-2">
            {actionLabel && onAction ? (
              <Button size="sm" variant="primary" onPress={onAction} isPending={busy} isDisabled={busy}>
                {actionLabel}
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button size="sm" variant="tertiary" onPress={onSecondaryAction} isDisabled={busy}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
