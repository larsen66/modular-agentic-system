import type { ReactNode } from 'react'

// Shared widget — viewport device frame. Constrains its child to a viewport width (desktop = full,
// tablet/mobile = fixed), centered, with a smooth width transition. Structural layout only (no
// custom CSS — width is an inline style driven by the caller's viewport token, the one case HeroUI
// has no primitive for). Reused by the canvas `preview` screen (and any embedded-surface preview).

export interface DeviceFrameProps {
  /** CSS width for the frame (`100%` desktop, `768px` tablet, `375px` mobile). */
  width: string
  children: ReactNode
}

export function DeviceFrame({ width, children }: DeviceFrameProps) {
  // `desktop` (100%) needs no wrapper math — fill the area. Narrower viewports center a fixed width.
  if (width === '100%') {
    return <div className="h-full w-full min-h-0">{children}</div>
  }
  return (
    <div className="flex h-full min-h-0 w-full justify-center">
      <div
        className="h-full min-h-0 transition-[width] duration-200 ease-out"
        style={{ width, maxWidth: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}
