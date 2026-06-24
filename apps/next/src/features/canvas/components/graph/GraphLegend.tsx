import { Card, Chip } from '@heroui/react'
import { useCanvasStrings } from '../../i18n'
import type { GraphLegendProps } from '../../types/graph'
import type { GraphNodeKind } from '@/core/appGraph'

// Legend overlay (bottom-left) — one Chip row per node kind present, plus the edge-semantics line.
// Drives non-overclaiming copy: containment graphs say "contains" (NOT "imports") until the module
// graph (`source: 'modules'`) exists (legacy trap #3). HeroUI Card + Chip; semantic tokens only.

const KIND_COLOR: Record<GraphNodeKind, 'accent' | 'default' | 'success'> = {
  app: 'accent',
  folder: 'default',
  chat: 'success',
  'mounted-app': 'default',
}

export function GraphLegend({ source, kindCounts }: GraphLegendProps) {
  const t = useCanvasStrings()
  const kinds = (Object.keys(kindCounts) as GraphNodeKind[]).filter((k) => (kindCounts[k] ?? 0) > 0)
  if (kinds.length === 0) return null

  return (
    <Card variant="default" className="max-w-[16rem]">
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs font-medium text-muted">{t.graph.legend.title}</p>
        <div className="flex flex-col gap-1">
          {kinds.map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <Chip size="sm" variant="soft" color={KIND_COLOR[k]}>
                {t.graph.kinds[k]}
              </Chip>
              <span className="text-xs text-muted">{kindCounts[k]}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          {source === 'links' ? t.graph.legend.edgesContains : t.graph.legend.edgesImports}
        </p>
      </div>
    </Card>
  )
}
