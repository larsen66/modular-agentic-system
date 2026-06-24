# `src/lib` — Pure utilities

Small, **pure, dependency-light** helper functions with no React, no backend, and no app state.
Framework-agnostic and trivially testable.

- `utils.ts` — `cn()` (clsx + tailwind-merge class composition).

## Rules

- Pure functions only. No `@core`/Supabase, no React hooks, no zustand, no i18n.
- If a helper needs backend data → it belongs in `src/core/**`. If it renders → `src/shared/**` or
  a feature module.
- Co-located tests: `utils.ts` → `utils.test.ts`.

Keep this folder small — it is for genuine cross-cutting utilities, not a junk drawer.
