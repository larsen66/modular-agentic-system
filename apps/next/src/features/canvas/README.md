# `features/canvas` — the Builder preview/canvas Stage pane

The canvas area: the right-hand Stage pane paired with Chat. Its load-bearing view is the **live app
preview** (iframe over the runner preview-proxy); the same pane also hosts a file reader, embedded L1
child apps, and the greenfield graph/history/diff views. Geometry (open/close, tiling↔overlay,
resize) is the **shell `Stage`'s**, not this module's — this module owns the pane's chrome + content.

**Design canon:** `docs/design/canvas/` (AREA.md + 7 screens + 5 flows + 9 legacy overviews).

## Allowed imports / dependency direction
- May import from lower layers only: `@/core/**` (the seam — all runner/Supabase access), `@/shared/**`
  (HeroUI widgets), `@/state/**`, `@/lib/**`, `@/i18n`. **No cross-feature imports** (ARCHITECTURE §5).
- Backend/runner access goes through `@/core/preview` (+ `@/core/runner`, `@/core/runnerSession`),
  never the Supabase client directly.

## Layout
```
index.ts            ← public surface (the ONLY export point)
types.ts            ← module types + component props (single types surface)
i18n/{en,de,index}  ← canvas strings (preview-tab strings live here, not under chat)
lib/                ← pure logic: previewState (simplified machine), deriveStage, previewUrl
hooks/              ← usePreview (lifecycle) + others        [Phase 2]
components/<screen>/ ← screen-local building blocks          [Phase 2]
screens/<screen>/   ← CanvasPane + per-screen views          [Phase 2]
__tests__/          ← all tests, mirroring the source path
```

## Build phases
1. **Foundation (done):** `@/core/preview` seam, `lib/**` (simplified 6-state machine, stage
   collapse, URL builder), types, i18n.
2. **Core preview surface:** `usePreview` lifecycle hook (monotonic gate, two-phase handoff, URL
   debounce, timers, boundary retry), shared widgets (`DeviceFrame`, `DegradedStatePanel`,
   `PreviewIframeHost`), the `preview` + `canvas-shell` screens, wire `<CanvasPane>` into `Stage`
   (replaces the mock `app/shell/preview/**`).
3. **Secondary surfaces:** file-reader, child-app-mount; flows visual-edit, share-publish.
4. **Greenfield:** graph, history, diff.
