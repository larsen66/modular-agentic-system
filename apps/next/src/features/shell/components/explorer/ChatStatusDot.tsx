import type { ChatAttentionState } from '@/core/status'

// Small attention indicator for a chat row in the Explorer tree. Conveys the chat's run state
// without polluting the row label. Only rendered when the parent passes a non-'none' attention.
//
//   running     → small pulsing green dot
//   error       → red dot
//   needs-input → yellow dot
//   unread      → blue dot
//   none        → nothing (caller guards this; component also guards)

interface ChatStatusDotProps {
  attention: ChatAttentionState
}

export function ChatStatusDot({ attention }: ChatStatusDotProps) {
  if (attention === 'none') return null

  const cls = getClass(attention)
  return (
    <span
      className={`pointer-events-none absolute right-7 block size-1.5 shrink-0 rounded-full ${cls}`}
      aria-hidden
    />
  )
}

function getClass(attention: ChatAttentionState): string {
  switch (attention) {
    case 'running':
      return 'bg-green-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    case 'needs-input':
      return 'bg-yellow-400'
    case 'unread':
      return 'bg-blue-400'
    default:
      return 'bg-muted'
  }
}
