import { useEffect, useCallback, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { EXPLORER_MIN_WIDTH, EXPLORER_MAX_WIDTH, useUiStore } from '@/state/uiStore'
import { Explorer, ExplorerResizer, Rail } from '@/features/shell'

// App shell — the global layout frame for the island. Owns the outer chrome (theme background,
// full-viewport frame) and the workbench regions: the persistent left Rail, the docked Explorer
// (opens out of the rail; resizable; closable), and the Stage host (route content in `main`).
// The Stage's dock-snap panes are added as their feature modules are built design-first (Principle
// XI). `bg-background text-foreground` so content follows the active HeroUI theme.
// Minimum drag distance before the explorer snaps open.
const OPEN_THRESHOLD = 20

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const explorerOpen = useUiStore((s) => s.explorerOpen)
  const explorerWidth = useUiStore((s) => s.explorerWidth)
  const setExplorerOpen = useUiStore((s) => s.setExplorerOpen)
  const setExplorerWidth = useUiStore((s) => s.setExplorerWidth)
  const setPreSettingsPath = useUiStore((s) => s.setPreSettingsPath)

  const onRailEdgePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      if (delta > OPEN_THRESHOLD) {
        const newWidth = Math.min(EXPLORER_MAX_WIDTH, Math.max(EXPLORER_MIN_WIDTH, delta))
        setExplorerWidth(newWidth)
        setExplorerOpen(true)
        cleanup()
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('blur', cleanup)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('blur', cleanup)
  }, [setExplorerOpen, setExplorerWidth])

  // Track the last non-settings path so "back from settings" always returns to a real destination,
  // even after a page reload while settings is open.
  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) {
      setPreSettingsPath(location.pathname + location.search)
    }
  }, [location.pathname, location.search, setPreSettingsPath])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Rail />
      {explorerOpen ? (
        <div className="flex h-full shrink-0" style={{ width: explorerWidth }}>
          <div className="min-w-0 flex-1 overflow-hidden border-r bg-overlay/30">
            <Explorer />
          </div>
          <ExplorerResizer />
        </div>
      ) : (
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-accent/50 transition-colors"
          onPointerDown={onRailEdgePointerDown}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
