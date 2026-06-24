import { Lock } from 'lucide-react'
import type { ProjectHealthState } from '@/core/status'

// Small status indicator overlaid on a project row. 6px dot (or a spinner/lock icon) communicates
// the health state from the Explorer tree's polling query. Renders nothing for 'idle'.
//
//   idle      → nothing
//   preparing → yellow pulsing dot
//   running   → green pulsing dot
//   ready     → solid green dot (no pulse)
//   degraded  → orange dot
//   error     → red dot
//
// If writeLocked=true AND health is running/degraded, shows a lock icon alongside the dot.

interface ProjectStatusDotProps {
  health: ProjectHealthState
  writeLocked: boolean
}

export function ProjectStatusDot({ health, writeLocked }: ProjectStatusDotProps) {
  if (health === 'idle') return null

  const dotClass = getDotClass(health)

  return (
    <span className="pointer-events-none absolute right-7 flex items-center gap-0.5" aria-hidden>
      <span className={`block size-1.5 rounded-full shrink-0 ${dotClass}`} />
      {writeLocked ? (
        <Lock className="size-2.5 text-muted" />
      ) : null}
    </span>
  )
}

function getDotClass(health: ProjectHealthState): string {
  switch (health) {
    case 'preparing':
      return 'bg-yellow-400 animate-pulse'
    case 'running':
      return 'bg-green-500 animate-pulse'
    case 'ready':
      return 'bg-green-500'
    case 'degraded':
      return 'bg-orange-400'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-muted'
  }
}
