import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Chip, Separator, Spinner } from '@heroui/react'
import { fetchOrgUsageSummary, type OrgUsageSummaryRow } from '@/core/settings'
import { fetchOrgMembers, type OrgMember } from '@/core/orgs'

// Per-member credit/usage breakdown — the "where did the credits go?" half of the merged
// Usage & billing surface. Moved out of the standalone Usage settings section so it composes as a
// HeroUI Card alongside the billing cards (the credit-balance readout lives in the billing
// CreditBalanceCard, so it is intentionally NOT repeated here). Reuses the existing core ops
// (`fetchOrgUsageSummary` + `fetchOrgMembers`) — no new backend.

type UsageRange = '7d' | '30d' | 'all'

interface AggregatedMemberUsage {
  userId: string
  runCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  lastRunAt: string | null
  models: Set<string>
}

export function UsageBreakdownCard({ orgId }: { orgId: string }) {
  const [usageRows, setUsageRows] = useState<OrgUsageSummaryRow[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [range, setRange] = useState<UsageRange>('30d')

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [rows, mems] = await Promise.all([
        fetchOrgUsageSummary(orgId),
        fetchOrgMembers(orgId),
      ])
      setUsageRows(rows)
      setMembers(mems)
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { void load() }, [load])

  const filteredRows = useMemo(() => {
    if (range === 'all') return usageRows
    const days = range === '7d' ? 7 : 30
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return usageRows.filter((r) => r.day >= threshold)
  }, [usageRows, range])

  const aggregated = useMemo<AggregatedMemberUsage[]>(() => {
    const byUser = new Map<string, AggregatedMemberUsage>()
    for (const row of filteredRows) {
      const inputTokens = row.totalInputTokens ?? 0
      const outputTokens = row.totalOutputTokens ?? 0
      const rowCost = row.totalCost ?? 0
      const existing = byUser.get(row.userId)
      if (existing) {
        existing.runCount += row.runCount
        existing.totalInputTokens += inputTokens
        existing.totalOutputTokens += outputTokens
        existing.totalCost += rowCost
        if (row.model) existing.models.add(row.model)
        if (row.lastRunAt && (!existing.lastRunAt || row.lastRunAt > existing.lastRunAt)) {
          existing.lastRunAt = row.lastRunAt
        }
      } else {
        byUser.set(row.userId, {
          userId: row.userId,
          runCount: row.runCount,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          totalCost: rowCost,
          lastRunAt: row.lastRunAt,
          models: new Set(row.model ? [row.model] : []),
        })
      }
    }
    return Array.from(byUser.values()).sort((a, b) => {
      if (!a.lastRunAt) return 1
      if (!b.lastRunAt) return -1
      return b.lastRunAt.localeCompare(a.lastRunAt)
    })
  }, [filteredRows])

  const getMemberDisplay = (userId: string): { name: string; email: string | null } => {
    const m = members.find((mem) => mem.id === userId)
    return { name: m?.fullName ?? 'Unknown', email: m?.email ?? null }
  }

  const totalRuns = aggregated.reduce((sum, r) => sum + r.runCount, 0)

  return (
    <Card>
      <Card.Header>
        <Card.Title>Usage</Card.Title>
        <Card.Description>Credit and token usage per member — where your credits are going.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {(['7d', '30d', 'all'] as UsageRange[]).map((key) => (
              <Button key={key} size="sm" variant={range === key ? 'secondary' : 'ghost'} onPress={() => setRange(key)}>
                {key === '7d' ? '7 days' : key === '30d' ? '30 days' : 'All time'}
              </Button>
            ))}
          </div>
          {!loading && !fetchError && (
            <Chip size="sm" variant="soft">
              {totalRuns.toLocaleString()} run{totalRuns !== 1 ? 's' : ''} · {aggregated.length} member{aggregated.length !== 1 ? 's' : ''}
            </Chip>
          )}
        </div>

        {fetchError ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{fetchError}</Alert.Description>
              <Button size="sm" variant="ghost" onPress={() => void load()} className="mt-1">Retry</Button>
            </Alert.Content>
          </Alert>
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner size="sm" /> Loading usage…
          </div>
        ) : aggregated.length === 0 ? (
          <Alert status="default">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>No usage yet for this period. It appears once members start running AI models.</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-default-200">
            {aggregated.map((row, i) => {
              const display = getMemberDisplay(row.userId)
              return (
                <div key={row.userId}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar size="sm">
                      <Avatar.Fallback>{display.name[0]?.toUpperCase() ?? '?'}</Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{display.name}</p>
                      {display.email && <p className="truncate text-xs text-muted">{display.email}</p>}
                      {row.models.size > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {Array.from(row.models).map((model) => (
                            <Chip key={model} size="sm" variant="soft" className="text-xs">{model}</Chip>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums text-muted">
                      <span className="text-sm font-medium text-foreground">
                        {row.runCount.toLocaleString()} run{row.runCount !== 1 ? 's' : ''}
                      </span>
                      <span>{(row.totalInputTokens + row.totalOutputTokens).toLocaleString()} tokens</span>
                      <span>${row.totalCost.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
