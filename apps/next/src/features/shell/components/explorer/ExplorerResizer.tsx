import type { PointerEvent as ReactPointerEvent } from 'react'
import { EXPLORER_MAX_WIDTH, EXPLORER_MIN_WIDTH, useUiStore } from '@/state/uiStore'
import { useShellStrings } from '../../i18n'

const KEYBOARD_STEP = 16
// Dragging below this width snaps the Explorer closed instead of clamping at EXPLORER_MIN_WIDTH.
const CLOSE_THRESHOLD = 160

// The Explorer dock's right-edge resizer. Pointer-drag updates the persisted width (clamped in the
// store). Release is robust (pointerup / pointercancel / window blur / Escape) so the body cursor
// never sticks — the legacy stuck-cursor bug, fixed from day one (flows/explorer-open-close.md §4).
// Keyboard-accessible (Arrow keys nudge). No custom CSS — structural + semantic tokens only.
export function ExplorerResizer() {
  const t = useShellStrings()
  const width = useUiStore((s) => s.explorerWidth)
  const setExplorerWidth = useUiStore((s) => s.setExplorerWidth)
  const setExplorerOpen = useUiStore((s) => s.setExplorerOpen)

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: PointerEvent) => {
      const newWidth = startW + (ev.clientX - startX)
      if (newWidth < CLOSE_THRESHOLD) {
        setExplorerOpen(false)
        cleanup()
      } else {
        setExplorerWidth(newWidth)
      }
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setExplorerWidth(startW)
        cleanup()
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('blur', cleanup)
      window.removeEventListener('keydown', onKey)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('blur', cleanup)
    window.addEventListener('keydown', onKey)
  }

  return (
    <div
      role="separator"
      aria-label={t.explorer.resize}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={EXPLORER_MIN_WIDTH}
      aria-valuemax={EXPLORER_MAX_WIDTH}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setExplorerWidth(width - KEYBOARD_STEP)
        else if (e.key === 'ArrowRight') setExplorerWidth(width + KEYBOARD_STEP)
      }}
      className="w-1 shrink-0 cursor-col-resize bg-default-200 hover:bg-accent"
    />
  )
}
