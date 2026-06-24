# `src/core` — Backend access seam (bottom layer)

The **only** place the island reaches the backend. Everything above (`features/`, `shared/`,
`pages/`) consumes typed functions from here and never imports the Supabase / `@core` client
directly (enforced by `scripts/check-island-boundaries.mjs`).

**The client is core-internal.** `core/supabase.ts` holds the Supabase client and may be imported
**only by other `core/*` modules**. Features/shared/app/pages consume typed operations (e.g.
`core/session`) — never the client, not even via the `core/supabase` re-export. The guard resolves
import paths and fails on any client import outside `core/`, so this is a real boundary.

The legacy core is **imported, never copied** — via the `@core` alias (`@core/* → ../../src/*`).
If a legacy helper is entangled with React 18 / legacy providers and won't import cleanly, wrap
it in a thin adapter here; do NOT fork its logic (Constitution v1.3.0 Principle X).

## What's here

- `supabase.ts` — the sole adapter re-exporting the shared legacy Supabase client. The only file
  permitted to import `@core/integrations/supabase/client`.
- `session.ts` — session access (proven in the connectivity test): `getCurrentUser()` and
  `onAuthChange()`. The island shares the same-origin session with the legacy app; use
  `getSession()`, not `getUser()` (which returned null in the island).

## Reference: proven Explorer RLS data path (not yet wired)

The connectivity test proved how to read the node graph under RLS. A **direct** select on
`organizations` / `workspaces` returns empty — membership comes first:

```
node_memberships(principal_id = userId, source_kind = 'direct_org')       → orgIds
node_memberships(principal_id = userId, source_kind = 'direct_workspace')  → directWsIds
v_nodes(kind = 'org',       source_id in orgIds)                           → orgs
v_nodes(kind = 'workspace') [RLS-scoped, then filter client-side by:       → workspaces
        directWsSet | organization_id in orgIds | created_by = userId]
v_nodes(kind = 'app',       workspace_id in wsIds, order updated_at desc)  → apps
project_chats(project_id in appIds, status != 'archived',
              order last_activity_at desc)                                 → chats
```

When the Explorer surface is built (design-first), implement this as `core/explorer.ts`
returning typed `OrgNode[]`; a feature hook then wraps it with react-query. The full working
implementation is recoverable from git history (removed in feature `003-island-modular-scaffold`
to keep the scaffold clean — the path itself is preserved above so the knowledge is not lost).
