import type { ReactNode } from 'react'
import { Button } from '@heroui/react'

export interface EmptyStateProps {
  /** Optional icon rendered above the title. */
  icon?: ReactNode
  /** Primary label. Required. */
  title: string
  /** Secondary description text. */
  description?: string
  /** Label for the optional action button. */
  actionLabel?: string
  /** Handler for the action button. Shown only when actionLabel is provided. */
  onAction?: () => void
}

/**
 * Shared empty-state block. Composes HeroUI primitives + Tailwind utilities — no custom CSS.
 * Backend-free: all content arrives via props. Used by 2+ surfaces (see shared/README.md rule).
 */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon !== undefined && (
        <span className="text-default-400" aria-hidden="true">
          {icon}
        </span>
      )}

      <p className="text-sm font-medium text-default-600">{title}</p>

      {description !== undefined && (
        <p className="max-w-xs text-sm text-default-400">{description}</p>
      )}

      {actionLabel !== undefined && (
        <Button size="sm" variant="secondary" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
