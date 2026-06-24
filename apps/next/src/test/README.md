# `src/test` — Global test layer (helpers only, no tests live here)

Tests are **modular** — they live WITH the code they cover, not in a central tree. This folder
holds only the shared scaffolding every test reuses.

> Runner status: **wired** (2026-06-13, first surface covered = `shell`). `vitest` +
> `@testing-library/{react,user-event,jest-dom}` + `jsdom` are installed; `vitest.config.ts`
> mirrors the vite aliases and loads `setup.ts`. Run with `npm test` (`vitest run`) or
> `npm run test:watch`. `setup.ts` polyfills the browser APIs HeroUI / React-Aria need in jsdom
> (matchMedia, ResizeObserver, pointer-capture, clipboard); `renderWithProviders.tsx` wraps a
> component in a fresh per-test QueryClient; `factories/` builds typed `User`/`Organization`
> fixtures.

## Where tests go (the convention)

| Test kind | Location | Example |
|---|---|---|
| Unit / component | **co-located** next to source | `shared/ConfirmDialog.tsx` → `ConfirmDialog.test.tsx` |
| Access-layer unit | co-located in `core/` | `core/session.ts` → `session.test.ts` |
| Feature integration | per-feature `__tests__/` | `features/explorer/__tests__/tree.test.tsx` |
| Cross-surface e2e | top-level `apps/next/e2e/` (later) | Playwright, added when surfaces exist |
| Shared helpers / setup | **here** (`src/test/`) | `renderWithProviders`, factories, `setup.ts` |

A feature owns its tests; the boundary guard keeps them from reaching into other features.

> The `shell` module groups **all** its tests under one `features/shell/__tests__/` tree whose
> subfolders mirror the source (`hooks/`, `i18n/`, `components/rail/`, `screens/rail/`) rather than
> co-locating units next to source. Either layout is fine; a module picks one and stays consistent.
> Seam access (`@/core/*`) is mocked with `vi.mock` per file so no test touches Supabase.

## What lives here (when wired)

- `setup.ts` — vitest setup (jsdom env, testing-library matchers, cleanup).
- `renderWithProviders.tsx` — renders a component wrapped in `AppProviders` (Query + Theme +
  I18n) so component tests get the real provider tree.
- `factories/` — typed fixture builders for `core/` domain types (test-only; mocks are allowed
  in tests per Constitution Principle VIII).

## To wire the runner (when first needed)

1. `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom` in `apps/next`.
2. Add `vitest.config.ts` (environment `jsdom`, `setupFiles: ['./src/test/setup.ts']`).
3. Add `"test": "vitest run"` + `"test:watch": "vitest"` to `apps/next/package.json`.
4. Implement `setup.ts` and `renderWithProviders.tsx`.
