import { useQuery } from '@tanstack/react-query'
import { Button, Description, Label, ListBox, ScrollShadow, Skeleton } from '@heroui/react'
import {
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  FolderOpen,
  RefreshCw,
} from 'lucide-react'
import { useUiStore } from '@/state/uiStore'
import { fetchActiveSessionForProject } from '@/core/session'
import { fetchSessionFileTree } from '@/core/files'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileIcon(filePath: string): React.ElementType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) return FileImage
  if (['json', 'jsonc'].includes(ext)) return FileJson
  if (
    [
      'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs',
      'java', 'cpp', 'c', 'h', 'cs', 'php', 'swift', 'kt', 'sh', 'bash',
      'zsh', 'fish', 'css', 'scss', 'less', 'html', 'vue', 'svelte',
    ].includes(ext)
  ) return FileCode
  if (['md', 'mdx', 'txt', 'rst', 'log'].includes(ext)) return FileText
  return File
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FilesPanel() {
  const activeNodeId = useUiStore((s) => s.activeNodeId)

  // Phase 1: find the active runner session for this project
  const sessionQuery = useQuery({
    queryKey: ['project-session', activeNodeId],
    queryFn: () => fetchActiveSessionForProject(activeNodeId!),
    enabled: activeNodeId !== null,
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  const sessionId = sessionQuery.data ?? null

  // Phase 2: fetch the live file tree from the runner
  const treeQuery = useQuery({
    queryKey: ['project-file-tree', sessionId],
    queryFn: () => fetchSessionFileTree(sessionId!, activeNodeId!),
    enabled: sessionId !== null && activeNodeId !== null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  // ── No project selected ──
  if (activeNodeId === null) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <FolderOpen className="h-7 w-7 text-default-300" aria-hidden />
          <p className="text-xs text-muted">Select a project to view its files</p>
        </div>
      </section>
    )
  }

  // ── Checking for session ──
  if (sessionQuery.isLoading) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-col gap-1 py-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  // ── No active session ──
  if (!sessionId) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <FolderOpen className="h-7 w-7 text-default-300" aria-hidden />
          <p className="text-xs text-muted">Files appear when the project has an active session</p>
        </div>
      </section>
    )
  }

  // ── Loading file tree ──
  if (treeQuery.isLoading) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-col gap-1 py-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
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

  // ── Tree error ──
  if (treeQuery.isError) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-xs text-danger">
            {(treeQuery.error as Error)?.message ?? 'Failed to load files'}
          </p>
          <Button size="sm" variant="secondary" onPress={() => void treeQuery.refetch()}>
            <RefreshCw className="h-3 w-3" aria-hidden />
            Retry
          </Button>
        </div>
      </section>
    )
  }

  const files = treeQuery.data?.files ?? []
  const truncated = treeQuery.data?.truncated ?? false

  // ── Empty workspace ──
  if (files.length === 0) {
    return (
      <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <FolderOpen className="h-7 w-7 text-default-300" aria-hidden />
          <p className="text-xs text-muted">No files in workspace</p>
        </div>
      </section>
    )
  }

  // ── File list ──
  return (
    <section aria-label="Files" className="flex h-full flex-col overflow-hidden">
      <ScrollShadow className="min-h-0 flex-1">
        <ListBox aria-label="Workspace files" selectionMode="none" className="w-full p-0">
          {files.map((filePath) => {
            const Icon = fileIcon(filePath)
            const segments = filePath.split('/')
            const name = segments[segments.length - 1] ?? filePath
            const dir = segments.length > 1 ? segments.slice(0, -1).join('/') : null

            return (
              <ListBox.Item key={filePath} id={filePath} textValue={filePath} className="overflow-hidden">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <Label className="block w-full truncate text-xs">{name}</Label>
                  {dir && (
                    <Description className="block w-full truncate text-xs">{dir}</Description>
                  )}
                </div>
              </ListBox.Item>
            )
          })}
        </ListBox>
        {truncated && (
          <p className="px-4 pb-3 text-center text-xs text-muted">
            Showing first 10 000 files
          </p>
        )}
      </ScrollShadow>
    </section>
  )
}
