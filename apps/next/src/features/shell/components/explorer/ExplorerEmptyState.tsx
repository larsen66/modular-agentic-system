import { Button } from '@heroui/react'
import type { ExplorerEmptyStateProps } from '../../types'

// Honest empty / error / unavailable state for the Explorer body (Principle VIII — never fake data).
// A muted message and, for errors, a retry. No custom CSS.
export function ExplorerEmptyState({ message, onRetry, retryLabel }: ExplorerEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
