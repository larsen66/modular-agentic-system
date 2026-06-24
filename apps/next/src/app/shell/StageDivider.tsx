import { useCallback, useEffect, useRef } from 'react'
import { useShellStrings } from '@/features/shell/i18n'
import type { StageOrient } from '@/state/uiStore'

const RATIO_MIN = 0.18
const RATIO_MAX = 0.82
const KEYBOARD_STEP = 0.04

interface StageDividerProps {
  /** Axis the two panes are split along — 'row' = vertical bar, 'col' = horizontal bar. */
  orient: StageOrient
  /** Current split ratio (0–1). Clamped to RATIO_MIN–RATIO_MAX by the parent. */
  ratio: number
  /** Called on every pointer-move / keyboard step with the new clamped ratio. */
  onRatioChange: (ratio: number) => void
}

/**
 * StageDivider — the draggable split bar between the two Stage panes.
 *
 * Mechanic (content-dock-snap.md §3 step 4):
 *  - Pointer drag: live ratio update via pointer capture; clamped 0.18–0.82.
 *  - Keyboard (role="separator"): ArrowLeft/Up decreases; ArrowRight/Down increases.
 *  - No HeroUI — this is pure engine chrome.
 */
export function StageDivider({ orient, ratio, onRatioChange }: StageDividerProps) {
  const t = useShellStrings()
  const isRow = orient === 'row'

  const barRef = useRef<HTMLDivElement>(null)
  // Keep a ref to the parent (Stage) to measure its size during drag.
  const parentSizeRef = useRef(0)

  // Cache the parent size when orientation changes. During drag, the onPointerDown handler
  // reads parentSizeRef.current at drag-start — measuring at that point gives the freshest
  // value without forcing a layout flush on every render.
  useEffect(() => {
    const el = barRef.current?.parentElement
    if (!el) return
    parentSizeRef.current = isRow ? el.getBoundingClientRect().width : el.getBoundingClientRect().height
  }, [isRow])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      const el = barRef.current
      if (!el) return
      el.setPointerCapture(e.pointerId)

      const startCoord = isRow ? e.clientX : e.clientY
      const startRatio = ratio

      // Re-measure at drag-start to pick up any resize since last orient-change.
      const parentEl = el.parentElement
      if (parentEl) {
        parentSizeRef.current = isRow
          ? parentEl.getBoundingClientRect().width
          : parentEl.getBoundingClientRect().height
      }
      const parentSize = parentSizeRef.current || 1

      const onMove = (me: PointerEvent) => {
        const coord = isRow ? me.clientX : me.clientY
        const delta = (coord - startCoord) / parentSize
        const next = Math.min(RATIO_MAX, Math.max(RATIO_MIN, startRatio + delta))
        onRatioChange(next)
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
    [isRow, ratio, onRatioChange],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const decrease = isRow
        ? e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
      const increase = isRow
        ? e.key === 'ArrowRight' || e.key === 'ArrowDown'
        : e.key === 'ArrowDown' || e.key === 'ArrowRight'

      if (decrease) {
        e.preventDefault()
        onRatioChange(Math.max(RATIO_MIN, ratio - KEYBOARD_STEP))
      } else if (increase) {
        e.preventDefault()
        onRatioChange(Math.min(RATIO_MAX, ratio + KEYBOARD_STEP))
      }
    },
    [isRow, ratio, onRatioChange],
  )

  // aria-valuenow as integer percentage for readability.
  const ariaValueNow = Math.round(ratio * 100)

  return (
    <div
      ref={barRef}
      role="separator"
      aria-label={t.stage.divider.label}
      aria-orientation={isRow ? 'vertical' : 'horizontal'}
      aria-valuenow={ariaValueNow}
      aria-valuemin={Math.round(RATIO_MIN * 100)}
      aria-valuemax={Math.round(RATIO_MAX * 100)}
      tabIndex={0}
      className={`
        group shrink-0 select-none
        ${isRow
          ? 'h-full w-1 cursor-col-resize'
          : 'h-1 w-full cursor-row-resize'
        }
        bg-divider opacity-0 transition-opacity
        hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:opacity-100
      `}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
