import { Card, Chip } from '@heroui/react'
import { AppWindow, Folder, MessageSquare, Boxes } from 'lucide-react'
import type { GraphNodeBodyProps } from '../../types/graph'
import type { GraphNodeKind } from '@/core/appGraph'

// The node body rendered INSIDE the GraphCanvas (design §3: the ONE place non-HeroUI structural
// markup is unavoidable; even here the body itself is a HeroUI Card.compact + Chip). Selecting fires
// `onPress` up to the screen. No custom CSS — semantic tokens + structural layout only.

const KIND_ICON: Record<GraphNodeKind, typeof AppWindow> = {
  app: AppWindow,
  folder: Folder,
  chat: MessageSquare,
  'mounted-app': Boxes,
}

// Semantic Chip color per kind (HeroUI tokens, never hex). Accent is WHITE per island doctrine.
const KIND_COLOR: Record<GraphNodeKind, 'accent' | 'default' | 'success'> = {
  app: 'accent',
  folder: 'default',
  chat: 'success',
  'mounted-app': 'default',
}

export function GraphNodeBody({ node, selected, dimmed = false, onPress }: GraphNodeBodyProps) {
  const Icon = KIND_ICON[node.kind] ?? AppWindow
  // A real <button> wraps the Card (Card is not pressable) so node selection is keyboard-accessible.
  return (
    <button
      type="button"
      aria-label={node.label}
      aria-pressed={selected}
      onClick={() => onPress(node.id)}
      className={`block w-full text-left ${dimmed ? 'opacity-40' : ''}`}
    >
      <Card variant={selected ? 'secondary' : 'default'}>
        <div className="flex items-center gap-2 p-2">
          <Icon className="size-4 text-muted" aria-hidden />
          <span className="truncate text-sm font-medium text-foreground">{node.label}</span>
          <Chip size="sm" variant="soft" color={KIND_COLOR[node.kind]}>
            {node.kind}
          </Chip>
        </div>
      </Card>
    </button>
  )
}
