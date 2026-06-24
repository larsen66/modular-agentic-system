# `src/features` — Feature modules layer

One self-contained module per **area** (Explorer, Builder/Chat, Canvas, Settings, Billing,
Marketplace, Workflow Ops, …). **This folder is currently empty** — no area has
been built yet. Areas are added one at a time, **design-first** (Area → Screen → Flow).

## Anatomy of a feature module (everything the area needs lives inside it)

```
features/<area>/
├── index.ts          # the module's ONLY public export surface
├── screens/          # one folder per screen (a view at rest); co-located *.test.tsx
│   └── <screen>/
├── components/       # area-local shared UI (HeroUI-idiomatic)
├── hooks/            # area-local state; data via src/core/** (NOT the supabase client)
├── i18n/             # this area's strings: en.ts, de.ts, index.ts (registers namespace)
├── __tests__/        # cross-screen integration tests for the area
├── types.ts
└── README.md
```

An area owns its **screens, UI, state, data hooks, translations, and tests** — added and removed
together. Screens are views INSIDE the module (design granularity ≠ module granularity — do not
split one module per screen). Nothing global is touched to ship or delete an area.

## How to add an area (the gate — Constitution v1.4.0 Principle XI)

An area = one feature module; design decomposes Area → Screen → Flow (see
`apps/next/docs/design/README.md`). Order:

1. Author + approve `docs/design/<area>/AREA.md` (IA/nav, scope model, the enumerated screen/flow
   map, area-level capability inventory) — **hard gate, the map comes first**.
2. Author + approve each `docs/design/<area>/screens/<screen>.md` and `flows/<flow>.md` **in
   separation** (templates in `docs/design/_templates/`).
3. Create `features/<area>/` per the anatomy above; screens are views inside it
   (`features/<area>/screens/…`) — do NOT split one module per screen.
4. Build HeroUI-idiomatic — right component + variant, NO custom CSS, verified via
   `apps/next/hero-ui-skill/scripts/*`; real data only (Principle VIII).
5. Verify against each artifact's capability inventory; run `npm run lint:boundaries`.

(A standalone single screen skips the area tree: one `docs/design/<surface>.md` from the screen
template, then build.)

## Rules (enforced by `scripts/check-island-boundaries.mjs`)

- A module exposes its public API through `index.ts` only.
- **No module imports from another feature module.** Shared needs go DOWN a layer
  (`shared/` for reused widgets, `core/` for backend access, `lib/` for pure utils).
- **No feature file imports the Supabase client** — directly, via `@core`, OR via the
  `core/supabase` re-export. Consume a **typed op** from `core/*` (e.g. `core/session`) instead.

## Tests (modular — co-located, per feature)

- Unit/component tests sit next to the file: `components/Foo.tsx` → `components/Foo.test.tsx`.
- Cross-component integration for the surface: `__tests__/`.
- Shared render helpers come from `src/test/`. See `src/test/README.md`.

## Localization (modular — per feature)

- This surface's strings live in `features/<surface>/i18n/{en,de}.ts` and register their
  namespace on load. No central catalog. See `src/i18n/README.md`.

**May import from:** own folder, `shared/`, `core/`, `state/`, `lib/`, `i18n/`.
