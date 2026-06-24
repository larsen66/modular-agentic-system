import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Description, Header, Label, ListBox, ScrollShadow, Skeleton } from '@heroui/react'
import { MessageSquare } from 'lucide-react'
import { supabase } from '@/core/supabase'
import { useActiveOrg } from '../../hooks/useActiveOrg'

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoryChat {
  id: string
  title: string
  projectId: string | null
  projectName: string | null
  activityAt: string | null
  runStatus: 'success' | 'error' | 'running' | null
}

// ── Data ───────────────────────────────────────────────────────────────────────

async function fetchOrgHistory(_orgId: string): Promise<HistoryChat[]> {
  const { data: chats, error: chatsErr } = await supabase
    .from('project_chats')
    .select('id, title, project_id, workspace_id, last_activity_at, last_message_at, created_at')
    .order('last_activity_at', { ascending: false })
    .limit(40)
  if (chatsErr) throw new Error(`fetchOrgHistory chats failed: ${chatsErr.message}`)

  const rows = chats ?? []
  if (rows.length === 0) return []

  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id as string | null).filter(Boolean)),
  ) as string[]

  const nameByProject = new Map<string, string>()
  if (projectIds.length > 0) {
    const { data: nodes } = await supabase
      .from('v_nodes')
      .select('source_id, name')
      .in('source_id', projectIds)
    for (const n of nodes ?? []) {
      nameByProject.set(n.source_id as string, (n.name as string) ?? 'Untitled')
    }
  }

  const chatIds = rows.map((r) => r.id as string)
  const runStatusByChat = new Map<string, 'success' | 'error' | 'running'>()
  if (chatIds.length > 0) {
    const { data: runs } = await supabase
      .from('runs')
      .select('chat_id, status, created_at')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false })
    for (const run of runs ?? []) {
      const chatId = run.chat_id as string | null
      if (!chatId || runStatusByChat.has(chatId)) continue
      const raw = (run.status as string) ?? ''
      const mapped: 'success' | 'error' | 'running' | null =
        raw === 'succeeded' ? 'success'
        : raw === 'failed' ? 'error'
        : raw === 'running' || raw === 'started' ? 'running'
        : null
      if (mapped) runStatusByChat.set(chatId, mapped)
    }
  }

  return rows.map((row) => {
    const projectId = (row.project_id as string) ?? null
    return {
      id: row.id as string,
      title: (row.title as string) || 'Untitled chat',
      projectId,
      projectName: projectId ? (nameByProject.get(projectId) ?? null) : null,
      activityAt:
        (row.last_activity_at as string) ??
        (row.last_message_at as string) ??
        (row.created_at as string) ??
        null,
      runStatus: runStatusByChat.get(row.id as string) ?? null,
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type DateGroup = 'Today' | 'Yesterday' | 'This week' | 'Earlier'
const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This week', 'Earlier']

function dateGroup(iso: string | null): DateGroup {
  if (!iso) return 'Earlier'
  const now = new Date()
  const d = new Date(iso)
  const diff = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000,
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff <= 7) return 'This week'
  return 'Earlier'
}

function groupItems(items: HistoryChat[]): Map<DateGroup, HistoryChat[]> {
  const map = new Map<DateGroup, HistoryChat[]>()
  for (const item of items) {
    const g = dateGroup(item.activityAt)
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return map
}

function runStatusColor(status: HistoryChat['runStatus']): 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'error') return 'danger'
  return 'warning'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HistoryPanel() {
  const { currentOrg } = useActiveOrg()
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery<HistoryChat[]>({
    queryKey: ['shell', 'history', currentOrg?.id ?? null],
    queryFn: () => fetchOrgHistory(currentOrg!.id),
    enabled: Boolean(currentOrg?.id),
    staleTime: 30_000,
  })

  function handleItemClick(item: HistoryChat) {
    if (item.projectId) {
      navigate(`/project/${item.projectId}/chat/${item.id}`)
    } else {
      navigate(`/project/${item.id}`)
    }
  }

  const grouped = groupItems(data ?? [])
  const activeGroups = GROUP_ORDER.filter((g) => grouped.has(g))

  // ── Loading ──
  if (isLoading) {
    return (
      <section aria-label="History" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-col gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-3.5 w-3.5 shrink-0 rounded" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // ── Error ──
  if (isError) {
    return (
      <section aria-label="History" className="flex h-full flex-col items-center justify-center gap-2 overflow-hidden px-4 py-8 text-center">
        <p className="text-xs text-danger">Failed to load history</p>
        <Button size="sm" variant="ghost" onPress={() => refetch()}>Retry</Button>
      </section>
    )
  }

  // ── Empty ──
  if ((data?.length ?? 0) === 0) {
    return (
      <section aria-label="History" className="flex h-full flex-col items-center justify-center overflow-hidden">
        <p className="text-center text-xs text-muted">No recent activity</p>
      </section>
    )
  }

  // ── List ──
  return (
    <section aria-label="History" className="flex h-full flex-col overflow-hidden">
      <ScrollShadow className="min-h-0 flex-1">
        <ListBox
          aria-label="Recent activity"
          selectionMode="none"
          onAction={(key) => {
            const item = (data ?? []).find((i) => i.id === String(key))
            if (item) handleItemClick(item)
          }}
          className="w-full p-0"
        >
          {activeGroups.map((group) => (
            <ListBox.Section key={group}>
              <Header>{group}</Header>
              {grouped.get(group)!.map((item) => (
                <ListBox.Item key={item.id} id={item.id} textValue={item.title} className="overflow-hidden">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <Label className="block w-full truncate text-xs">{item.title}</Label>
                    <Description className="block w-full truncate text-xs">
                      {[item.projectName, relativeTime(item.activityAt)].filter(Boolean).join(' · ')}
                    </Description>
                  </div>
                  {item.runStatus && (
                    <Chip size="sm" variant="soft" color={runStatusColor(item.runStatus)} className="shrink-0">
                      <Chip.Label>
                        {item.runStatus === 'success' ? '✓' : item.runStatus === 'error' ? '✗' : '…'}
                      </Chip.Label>
                    </Chip>
                  )}
                </ListBox.Item>
              ))}
            </ListBox.Section>
          ))}
        </ListBox>
      </ScrollShadow>
    </section>
  )
}
