import { useCallback, useEffect, useRef } from 'react'
import { useUiStore } from '@/state/uiStore'

// Width thresholds (px). Must match the constants in uiStore.
const WIDTH_MIN = 220
const WIDTH_MAX = 420
// Drag left of this threshold snaps the panel closed.
const SNAP_CLOSE_THRESHOLD = 110

interface ResizeHandleProps {
  /** aria-label for the separator element (supply a translated string). */
  ariaLabel: string
}

/**
 * ResizeHandle — the 4px drag strip between the Explorer panel and the Stage.
 *
 * Mechanics (per explorer-open-close.md §3):
 *  - Pointer-drag changes explorerWidth live, clamped 220–420.
 *  - Drag left until clientX falls below ~110 px from the rail edge
 *    (i.e. current width < SNAP_CLOSE_THRESHOLD) → snap closed; the last
 *    width is remembered for reopen.
 *  - Keyboard (role="separator" + aria-orientation="vertical"):
 *      ArrowLeft / ArrowDown  → width − 16, or snap closed below threshold.
 *      ArrowRight / ArrowUp   → width + 16 (also reopens if closed).
 *
 * No custom CSS — Tailwind utilities only. HeroUI tokens for cursor/colour.
 */
export function ResizeHandle({ ariaLabel }: ResizeHandleProps) {
  const explorerOpen = useUiStore((s) => s.explorerOpen)
  const explorerWidth = useUiStore((s) => s.explorerWidth)
  const setExplorerOpen = useUiStore((s) => s.setExplorerOpen)
  const setExplorerWidth = useUiStore((s) => s.setExplorerWidth)

  // Use a ref so the pointermove handler always sees the latest width without
  // stale closures.
  const widthRef = useRef(explorerWidth)
  useEffect(() => {
    widthRef.current = explorerWidth
  }, [explorerWidth])

  const handleRef = useRef<HTMLDivElement>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const el = handleRef.current
      if (!el) return
      el.setPointerCapture(e.pointerId)

      const startX = e.clientX
      const startWidth = widthRef.current
      let didSnap = false

      const onMove = (me: PointerEvent) => {
        const delta = me.clientX - startX
        const nextWidth = startWidth + delta

        if (nextWidth < SNAP_CLOSE_THRESHOLD) {
          // Snap closed — remember the pre-snap width (already persisted in store).
          if (!didSnap) {
            didSnap = true
            setExplorerOpen(false)
          }
          return
        }

        didSnap = false
        const clamped = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, nextWidth))
        setExplorerWidth(clamped)
        if (!explorerOpen) setExplorerOpen(true)
      }

      const onUp = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
    },
    // explorerOpen is used inside the handler only for the reopen guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setExplorerOpen, setExplorerWidth],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 16
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = explorerWidth - step
        if (next < SNAP_CLOSE_THRESHOLD) {
          setExplorerOpen(false)
        } else {
          setExplorerWidth(Math.max(WIDTH_MIN, next))
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = explorerWidth + step
        setExplorerWidth(Math.min(WIDTH_MAX, next))
        if (!explorerOpen) setExplorerOpen(true)
      }
    },
    [explorerOpen, explorerWidth, setExplorerOpen, setExplorerWidth],
  )

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuenow={explorerOpen ? explorerWidth : 0}
      aria-valuemin={0}
      aria-valuemax={WIDTH_MAX}
      tabIndex={0}
      className="flex h-full w-1 shrink-0 cursor-col-resize select-none items-center justify-center bg-divider opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:opacity-100"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
