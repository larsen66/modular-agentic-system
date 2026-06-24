import { Skeleton } from '@heroui/react'

// Tree-row-shaped loading placeholder (HeroUI Skeleton). Rendered while a branch or the tree root
// is fetching — sized to a row so the layout doesn't jump.
export function TreeSkeleton({ rows = 3, indent = 0 }: { rows?: number; indent?: number }) {
  return (
    <div className="flex flex-col gap-1 py-1" aria-hidden style={{ paddingLeft: indent * 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full rounded-medium" />
      ))}
    </div>
  )
}
