# Per-user session & chat-history isolation (1:1 prod)

This build reproduces the **production isolation mechanism** of vbp-german/BOS:
per-user separation of sessions, runs, and chat history is enforced by
**Supabase Row-Level Security (RLS)** — the same SQL predicate that protects
prod — not by hand-rolled `WHERE` filters in the runner.

> Why RLS and not app-level filtering: the isolation boundary lives one layer
> below the application. Even a bug in a new runner endpoint cannot leak another
> user's runs, because Postgres itself refuses the rows. That guarantee is the
> whole point of copying prod 1:1.

---

## 1. The model in one picture

```
 Bearer JWT ──▶ admin.auth.getUser() ──▶ ownerId            (src/server/auth.ts)
                                            │
 WRITE (runner)         service_role key, bypasses RLS       (src/server/db/runStore.ts)
   runs.admission.principal.requested_by_user_id = ownerId   ← ownership identity
                                            │
 READ (history)         caller JWT, RLS-scoped               (src/server/db/historyRead.ts)
   SELECT … FROM runs_user_visible          ← check_run_ownership(id, auth.uid())
```

- **Identity of a run** is not a `user_id` column — it is
  `runs.admission.principal.requested_by_user_id`, exactly like prod.
- **Who may read a run** = `check_run_ownership(run_id, caller)`:
  the admission actor **OR** a workspace member whose org has
  `workspace_run_visibility = true` (hybrid actor / workspace toggle).
- **Sessions** (live workspace handles) are owner-stamped in-process and
  cross-owner access returns 404 (`SessionManager` + `SessionOwnershipError`).

---

## 2. What is 1:1 vs deliberately simplified

| Area | Status | Prod source |
|---|---|---|
| `runs` / `run_events` tables, `seq` replay, service-role write | **verbatim** | `20260220300000_runs_history.sql`, `20260404150000_run_events_table.sql` |
| `runs.admission` ownership identity | **verbatim** | `20260511145638_runs_admission_jsonb.sql` |
| `check_run_ownership` predicate (actor OR workspace-visibility) | **verbatim** | `20260519030001_check_run_ownership_helper.sql` |
| Tightened `runs`/`run_events` RLS policies | **verbatim** | `20260519030002_runs_workspace_read_tighten.sql` |
| `runs_user_visible` view (security_invoker) | trimmed projections | `20260519030003_runs_user_visible_view.sql` |
| `project_chats` / `chat_messages` + their RLS | **policy text verbatim** | `20260306172000_project_chats_rls.sql`, `20260312080000_add_chat_messages.sql` |
| `org_settings.workspace_run_visibility` toggle | **verbatim** | `20260519030000_org_settings_workspace_run_visibility.sql` |
| Tenancy graph (`organizations`, `workspaces`, `workspace_members`, `org_settings`, `user_mini_apps`, `profiles`) | **minimal faithful shapes** | `20260218200000_access_hierarchy.sql`, `20260220120000_org_tables.sql`, pg_dump base |
| `can_access_project` / `is_workspace_member` / `get_org_role_for_workspace` | **collapsed to one membership predicate** | the ~15 evolved access migrations (node_memberships, direct ACL, org sharing) |

**Why the tenancy graph is simplified, not copied:** prod's `can_access_project`
transitively depends on `node_memberships`, `node_links`, direct-ACL, org-sharing
control-plane, platform-roles/impersonation, and a full `pg_dump` base — a literal
dependency closure is *fork the entire prod schema*. We reproduce the **isolation
semantics** (who can read whose runs/chats) exactly, backed by the smallest
membership graph that makes the verbatim policy text execute.

Two intentional deltas, both documented in the migrations:
- `workspace_members.role` includes `'viewer'` so the prod chat policy text
  (`role = 'viewer'`) runs verbatim; in prod 'viewer' arrives via the org-role layer.
- `pg_input_is_valid(x,'uuid')` (PG16+) → `public.is_uuid(x)` regex helper, the
  exact PG15 substitution prod's own migration prescribes in its comments.

---

## 3. Run it

```bash
# 1. bring up local Supabase (ports shifted to 553xx to coexist with other stacks)
supabase start                      # applies migrations/ + seed.sql

# 2. wire the runner
cp .env.example .env                # local-stack defaults are pre-filled

# 3. start the runner, then exercise a run attributed to Alice's project
npm run dev
curl -N -X POST localhost:3000/message \
  -H 'content-type: application/json' \
  -d '{"harness":"sdk","environment":"local","prompt":"hi",
       "projectId":"a1111111-0000-0000-0000-0000000000a1"}'
# (DEV_NO_AUTH=1 stamps ownerId = Alice; the run persists to Supabase.)
```

History reads require a **real JWT** (RLS needs `auth.uid()`). Get one from the
local GoTrue and call `/history`:

```bash
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H 'content-type: application/json' \
  -d '{"email":"alice@local.test","password":"password"}' | jq -r .access_token)
curl -s localhost:3000/history -H "authorization: Bearer $TOKEN"   # Alice's runs
# Repeat with bob@local.test → empty (isolation).
```

---

## 4. Real data for testing

The default `seed.sql` is two synthetic users (Alice/Bob) in separate
workspaces. To test against **real** prod identities/projects without a runtime
prod dependency, mirror real rows into the local DB:
`supabase/seed.real.example.sql` has the extraction queries + a template. Real
prod JWTs do not validate locally (different signing secret), so the real user is
recreated locally with their real UUID + a known dev password — real identity,
local auth.

---

## 5. Verification record (proven against live Postgres RLS)

`supabase start` (PG15 local) → migrations + seed applied clean (8 tables, 12
chat/run policies). Simulating `auth.uid()` for each user:

| Check | Expected | Result |
|---|---|---|
| Alice → `runs_user_visible` (own run) | 1 | **1** |
| Bob → `runs_user_visible` | 0 | **0** |
| Bob → base `runs` / `run_events` (direct PostgREST-style read) | 0 / 0 | **0 / 0** |
| After `workspace_run_visibility=true` + Bob added to Alice's WS | 1 | **1** |

The last row confirms BOTH clauses of the hybrid predicate — actor-only by
default, workspace-wide only when the org toggle is on — behave exactly as prod.
