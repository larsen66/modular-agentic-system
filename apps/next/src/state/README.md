# `src/state` — Cross-cutting UI state layer

Island-local **client UI state** that is genuinely cross-cutting (spans surfaces). NOT server
state — server/backend data lives behind `src/core/**` and is cached by the island's react-query
client (`app/providers.tsx`).

- `uiStore.ts` — currently just theme (light/dark, CSS-driven via the `dark` class on `<html>`).

**Rule of thumb:** surface-specific UI state belongs INSIDE that feature module
(`features/<surface>/hooks`), not here. Only promote state to `state/` when multiple surfaces
truly share it.

**Must NOT import:** `features/`, `core/`, the backend client.
