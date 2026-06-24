import { useMemo, useState } from 'react'
import { Button, Chip, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/shared/EmptyState'
import { useUiStore } from '@/state/uiStore'
import { usePreviewMetadata } from '../hooks/usePreviewMetadata'

type Viewport = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_CLASS: Record<Viewport, string> = {
  desktop: 'w-full',
  tablet: 'w-[760px] max-w-full',
  mobile: 'w-[390px] max-w-full',
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return replacements[char]
  })
}

function srcDoc(appName: string) {
  const safeAppName = escapeHtml(appName)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #172554; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; box-sizing: border-box; }
      section { width: min(680px, 100%); border: 1px solid #cbd5e1; border-radius: 10px; background: white; padding: 28px; box-shadow: 0 18px 45px rgba(15, 23, 42, .08); }
      p { margin: 8px 0 0; color: #475569; line-height: 1.5; }
      strong { color: #0f172a; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <strong>${safeAppName}</strong>
        <p>Preview surface mounted in the Island Stage.</p>
      </section>
    </main>
  </body>
</html>`
}

export function PreviewScreen() {
  const selectedNode = useUiStore((s) => s.selectedNode)
  const previewQuery = usePreviewMetadata(selectedNode)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [reloadKey, setReloadKey] = useState(0)

  const appName =
    previewQuery.data?.appName ??
    (selectedNode?.kind === 'app' ? selectedNode.name : selectedNode?.appName ?? selectedNode?.name) ??
    'Selected app'
  const frameDoc = useMemo(() => srcDoc(appName), [appName, reloadKey])
  const frameSrc = previewQuery.data?.previewUrl
    ? `${previewQuery.data.previewUrl}${previewQuery.data.previewUrl.includes('?') ? '&' : '?'}_islandReload=${reloadKey}`
    : null

  if (!selectedNode) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="No app selected" description="Choose an app in Explorer to open Preview." />
      </div>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background" aria-label="Preview">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Chip color="success" size="sm" variant="soft">
            Preview
          </Chip>
          <span className="truncate text-sm font-medium">{appName}</span>
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {previewQuery.isFetching
            ? 'Resolving preview'
            : previewQuery.data?.runnerSessionId
              ? `Runner ${previewQuery.data.runnerSessionId}`
              : 'Local fallback'}
        </span>

        <div className="flex items-center gap-1">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([viewport])}
            onSelectionChange={(keys) => {
              const next = [...keys][0]
              if (next) setViewport(next as Viewport)
            }}
          >
            <ToggleButton id="desktop" aria-label="Desktop viewport">
              Desktop
            </ToggleButton>
            <ToggleButton id="tablet" aria-label="Tablet viewport">
              Tablet
            </ToggleButton>
            <ToggleButton id="mobile" aria-label="Mobile viewport">
              Mobile
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Reload preview"
            onPress={() => setReloadKey((n) => n + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Open preview"
            isDisabled={!frameSrc}
            onPress={() => {
              if (frameSrc) window.open(frameSrc, '_blank', 'noopener,noreferrer')
            }}
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-default-50 p-3">
        <div className={`mx-auto h-full min-h-[320px] transition-[width] ${VIEWPORT_CLASS[viewport]}`}>
          <iframe
            key={reloadKey}
            title={`${appName} preview`}
            data-testid="island-preview-iframe"
            className="h-full min-h-[320px] w-full rounded-md border border-border bg-white shadow-sm"
            sandbox=""
            src={frameSrc ?? undefined}
            srcDoc={frameSrc ? undefined : frameDoc}
          />
        </div>
      </div>
    </section>
  )
}
