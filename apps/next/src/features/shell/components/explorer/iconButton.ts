// Shared styling for the trailing row controls (the "+" create and "⋯" menu buttons). Deliberately
// minimal: a small square that lets HeroUI's own Button center the icon — no flex / min-width /
// padding overrides to fight. `size-6!` just overrides HeroUI's default icon-only width; the corner
// radius comes from the global `--radius` (index.css), so no per-button `rounded-*` here. On hover
// the control swaps its `--button-bg-hover` token to `--default-hover` — one subtle step past the
// row's own `--default` hover background — so pointing at a control reads as a light accent.
//
// No press animation, no movement. HeroUI shrinks the whole button on press (`scale(.98)`), dragging
// the icon with it. Note the base `.button` always carries `transform: translateZ(0) …` (a GPU-layer
// hint) — so setting `transform: none` on press would TOGGLE that layer off and re-rasterize, nudging
// the icon a subpixel (the "shifting" we saw). Instead we PIN the transform to `translateZ(0)` in
// every state: `!important` blocks the press `scale()`, and because the value never changes the layer
// stays put — truly zero movement. (The "⋯" button's Dropdown.Trigger gets the same pin in NodeMenu.)
export const EXPLORER_ICON_BUTTON_CLASS =
  'size-6! [--button-bg-hover:var(--default-hover)]! [transform:translateZ(0)]!'
