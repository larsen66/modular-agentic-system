import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, DisclosureGroup, ScrollShadow, Separator, Skeleton } from '@heroui/react'
import { FileX } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { DiffHeader } from '../../components/diff/DiffHeader'
import { DiffFileRow } from '../../components/diff/DiffFileRow'
import { useDiffStrings } from '../../components/diff/diffStrings'
import { useRunDiff } from './useRunDiff'
import type { DiffScreenProps, DiffStyle } from '../../types/diff'

// The `diff` screen — line-level file changes a single run produced (Variant A: file list + per-file
// collapsible bodies, one screen-wide unified/split toggle). Composition only: header + file list +
// honest states (loading / no-run / error / no-changes). READ-ONLY — no accept/reject/apply/rollback
// affordance exists here (governed apply is OPS-domain). No custom CSS — HeroUI + structural layout.

const COMPACT_WIDTH = 640 // px — below this, split needs more room than there is → force unified.
const AUTO_EXPAND_THRESHOLD = 5 // small change sets start expanded; large ones start collapsed.

export function DiffScreen({ runId }: DiffScreenProps) {
  const t = useDiffStrings()
  const { data, isLoading, isError, refetch } = useRunDiff(runId)
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified')

  // Compact detection (ResizeObserver) — structural, no custom CSS; forces unified when narrow.
  const rootRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setCompact(entries[0].contentRect.width < COMPACT_WIDTH))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const files = useMemo(() => data?.files ?? [], [data])
  const allKeys = useMemo(() => files.map((f) => f.path), [files])

  // Expansion is screen-owned (drives collapse-all/expand-all + lazy body mount).
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  // Re-seed the default expansion when the run's file set changes (small diffs auto-expand). Resetting
  // user-owned expansion state to a fresh default on a new run is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedKeys(allKeys.length <= AUTO_EXPAND_THRESHOLD ? new Set(allKeys) : new Set())
  }, [allKeys])

  const totals = useMemo(
    () =>
      files.reduce(
        (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
        { additions: 0, deletions: 0 },
      ),
    [files],
  )

  const allExpanded = allKeys.length > 0 && expandedKeys.size === allKeys.length
  const toggleAll = () => setExpandedKeys(allExpanded ? new Set() : new Set(allKeys))

  const effectiveStyle: DiffStyle = compact ? 'unified' : diffStyle

  // ── States ──
  if (!runId) {
    return (
      <DegradedStatePanel icon={<FileX className="size-8" />} title={t.noRun.title} description={t.noRun.description} />
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">
        <Skeleton className="h-8 w-full rounded-medium" />
        <Skeleton className="h-10 w-full rounded-medium" />
        <Skeleton className="h-10 w-full rounded-medium" />
        <Skeleton className="h-10 w-full rounded-medium" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6">
        <Alert status="danger" className="max-w-md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t.error.title}</Alert.Title>
            <Alert.Description>{t.error.description}</Alert.Description>
            <Button className="mt-2" size="sm" variant="secondary" onPress={refetch}>
              {t.error.retry}
            </Button>
          </Alert.Content>
        </Alert>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <DegradedStatePanel icon={<FileX className="size-8" />} title={t.empty.title} description={t.empty.description} />
    )
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-background">
      <DiffHeader
        fileCount={files.length}
        totalAdditions={totals.additions}
        totalDeletions={totals.deletions}
        diffStyle={effectiveStyle}
        onDiffStyleChange={setDiffStyle}
        allExpanded={allExpanded}
        onToggleAll={toggleAll}
        compact={compact}
      />
      <Separator />
      <ScrollShadow className="min-h-0 flex-1" orientation="vertical">
        <DisclosureGroup
          allowsMultipleExpanded
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => setExpandedKeys(new Set([...keys].map(String)))}
          className="flex flex-col gap-1 p-2"
        >
          {files.map((file) => (
            <DiffFileRow
              key={file.path}
              file={file}
              diffStyle={effectiveStyle}
              isExpanded={expandedKeys.has(file.path)}
            />
          ))}
        </DisclosureGroup>
      </ScrollShadow>
    </div>
  )
}
