import { createCSSVariablesTheme } from '@pierre/diffs'

// The single CSS-variables theme shared by every `DiffFileBody` (design §6 implementation note).
// `@pierre/diffs` re-exports Shiki's `createCssVariablesTheme`: instead of baking literal hex per
// token, the highlighter emits `var(--<prefix>-token-color, <fallback>)` so syntax colors resolve
// from CSS variables at render time — auto-adapting to light/dark with NO bespoke Shiki hex and NO
// custom CSS authored here (we only choose the variable namespace + sensible inherited fallbacks
// that defer to HeroUI's foreground/muted tokens via `currentColor`). The add/remove ROW backgrounds
// are the library's own `success`/`danger`-class gutters, which inherit the page's semantic tokens.
//
// One instance, created once at module load and reused for all files (stable identity → the worker
// pool can cache tokenization across files and across unified/split toggles).
export const diffTheme = createCSSVariablesTheme({
  name: 'canvas-diff',
  variablePrefix: '--canvas-diff-',
  // Fall back to the inherited text color (HeroUI `foreground`/`muted` via `currentColor`) when a
  // token variable is undefined — keeps unstyled-but-readable output instead of bespoke hex.
  variableDefaults: {},
  fontStyle: true,
})
