# `src/shared` — Shared widgets

Our own multi-part components, assembled from `@heroui/react` primitives and **reused by 2+
surfaces** — e.g. a confirm dialog, an empty-state block, a toolbar. Putting them here keeps them
from being duplicated across features.

A widget used by only one surface belongs inside that feature module (`features/<surface>/
components/`), not here. Empty for now — add a widget when a real second consumer appears.

## Styling & branding (no wrapper layer)

We do **not** wrap HeroUI to "bake in" brand defaults. HeroUI is an npm package; styling is done
the idiomatic way:

- brand tokens (the `accent` token, radius, sizing) in the **HeroUI theme / CSS config**, and
- per-use props/variants when composing a component, verified via `apps/next/hero-ui-skill/scripts/*`.

So a widget here just composes HeroUI primitives directly — no indirection.

## Rules (enforced by `scripts/check-island-boundaries.mjs`)

- **Backend-free.** No `@core` / Supabase imports. Data arrives via props (a feature hook fetches
  it through `src/core/**`).
- HeroUI-idiomatic, NO custom CSS, verified via `apps/next/hero-ui-skill/scripts/*`; brand token is
  `accent` (HeroUI has no `primary`).
- Co-located tests: `ConfirmDialog.tsx` → `ConfirmDialog.test.tsx` (see `src/test/README.md`).

**May import from:** `@heroui/react`, `lib/`, `state/` (rarely), `i18n/`, other shared widgets.
**Must NOT import:** `features/`, `core/`.
