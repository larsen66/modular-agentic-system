import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useCanvasStrings } from '@/features/canvas'

const KEYBOARD_STEP = 16

interface PreviewResizerProps {
  /** Effective preview pane width (drives aria + drag math). */
  width: number
  /** Inset of the preview *card* inside its layer (matches the card's `p-2`), so the handle locks
   *  onto the card's visible left edge rather than the layer edge. */
  cardInset: number
  /** Floor (PREVIEW_MIN_WIDTH) and live ceiling (container − gutter). */
  min: number
  max: number
  onResize: (width: number) => void
  /** Grabbing the resizer is a preview gesture → bring the preview to front (+ Stage disables its
   *  width transition so the pane tracks the pointer 1:1). */
  onGrab?: () => void
  /** Drag ended (pointer up / cancel / blur / Escape) — Stage re-enables the width transition. */
  onRelease?: () => void
}

// Width of the (invisible) drag zone, in px. The visible pill is centered within it.
const HIT = 16

const clamp = (w: number, min: number, max: number) => Math.min(max, Math.max(min, w))

// The Preview pane's left-edge resizer. Pinned to the preview's left edge (`right: width`) and
// floats above both panes (z-30) so it stays graspable even once the preview overlays the chat.
// Drag is relative (no container-offset math); release is robust (pointerup / pointercancel / blur /
// Escape→restore) so the body cursor never sticks. Keyboard-accessible. The seam itself is the
// preview's `border-l`; this handle is transparent until hover/drag, so when it floats over the chat
// it adds no stray line. No custom CSS — structural + semantic tokens only.
export function PreviewResizer({ width, cardInset, min, max, onResize, onGrab, onRelease }: PreviewResizerProps) {
  const t = useCanvasStrings()
  const [dragging, setDragging] = useState(false)
  // Center the drag zone exactly on the card's left edge (which sits `cardInset` in from the layer's
  // left edge, i.e. `width - cardInset` from the Stage's right edge). No transform — the right offset
  // is computed directly so the handle can never drift away from the card.
  const right = width - cardInset - HIT / 2

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    onGrab?.()
    const startX = e.clientX
    const startW = width
    setDragging(true)
    // Dragging left (negative delta) grows the right-docked preview, hence `startW − delta`.
    const onMove = (ev: PointerEvent) => onResize(clamp(startW - (ev.clientX - startX), min, max))
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onResize(startW)
        cleanup()
      }
    }
    const cleanup = () => {
      setDragging(false)
      onRelease?.()
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
      aria-label={t.resize}
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        // Handle moves with the arrow; moving it left enlarges the right-docked preview.
        if (e.key === 'ArrowLeft') onResize(clamp(width + KEYBOARD_STEP, min, max))
        else if (e.key === 'ArrowRight') onResize(clamp(width - KEYBOARD_STEP, min, max))
      }}
      style={{ right }}
      className="group absolute inset-y-0 z-30 flex w-4 cursor-col-resize items-center justify-center"
    >
      {/* Full-height drag zone, but the only thing drawn is a short pill in the vertical middle.
          Hidden at rest — it fades in on hover (or while dragging) so it's there only when needed.
          Foreground (not accent), and a fixed size: no grow-on-press. */}
      <span
        className={`h-16 w-1 rounded-full bg-foreground transition-opacity ${
          dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      />
    </div>
  )
}
