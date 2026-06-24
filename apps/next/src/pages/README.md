# `src/pages` — Route entry layer

Thin route-entry components referenced by `app/router/routes.tsx`. A page composes one or more feature
modules into a route; it holds no business logic of its own.

_(No pages yet.)_ The root route mounts the shell frame + Stage directly in `app/router/routes.tsx`
(`<AppShell><Stage /></AppShell>`); the Stage hosts the Chat pane from `features/chat`. Add a page
here when a route needs to compose multiple feature surfaces.

**May import from:** `features/`, `shared/`, `state/`. **Should NOT** call `core/` directly —
that belongs inside feature modules.
