import { useEffect, type ReactNode } from 'react'
import { applyTheme, useUiStore } from '../../state/uiStore'

// Applies the active theme to <html> on change. HeroUI dark-mode is CSS-driven via the `dark`
// class; the theme value itself lives in the cross-cutting UI store (src/state/uiStore).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  return <>{children}</>
}
