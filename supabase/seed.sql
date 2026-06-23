-- seed.sql — runs automatically on `supabase db reset`.
-- Synthetic two-user baseline so the isolation model is exercisable out of the
-- box WITHOUT prod access: Alice and Bob live in different orgs/workspaces;
-- Alice owns a project + main chat. After a run admitted by Alice, Bob (and a
-- query under Bob's JWT) must see ZERO of Alice's runs — that is the proof.
--
-- For REAL-data testing (the chosen path), overlay real prod rows on top of
-- this baseline via supabase/seed.real.example.sql — see ISOLATION.md §Real data.

-- Deterministic IDs (easy to reference from curl / tests).
--   Alice  user : 11111111-1111-1111-1111-111111111111  (alice@local.test / password)
--   Bob    user : 22222222-2222-2222-2222-222222222222  (bob@local.test   / password)
--   Org A        : a0a0a0a0-0000-0000-0000-000000000001
--   Workspace A  : a0000000-0000-0000-0000-00000000000a   (Alice)
--   Workspace B  : b0000000-0000-0000-0000-00000000000b   (Bob)
--   Project A    : a1111111-0000-0000-0000-0000000000a1
--   Chat A (main): a2222222-0000-0000-0000-0000000000a2

-- ── auth.users (local GoTrue) ────────────────────────────────────────────
-- crypt()/gen_salt() come from pgcrypto (extensions schema, on search_path in
-- local Supabase). Password = 'password' for both.
-- NOTE: the *_token / *_change text columns MUST be '' (not NULL). GoTrue's Go
-- row scanner can't read NULL into a string and fails password login with
-- "Database error querying schema" — the classic hand-seeded-user gotcha.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@local.test', crypt('password', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alice"}',
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob@local.test', crypt('password', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Bob"}',
   '', '', '', '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- GoTrue needs an identities row for email/password login to resolve.
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
)
VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@local.test"}', 'email', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@local.test"}', 'email', now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── public profiles ──────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, display_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@local.test', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob@local.test', 'Bob')
ON CONFLICT (id) DO NOTHING;

-- ── org + settings (workspace_run_visibility default false = owner-only) ──
INSERT INTO public.organizations (id, name, created_by) VALUES
  ('a0a0a0a0-0000-0000-0000-000000000001', 'Acme', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.org_settings (org_id, workspace_run_visibility) VALUES
  ('a0a0a0a0-0000-0000-0000-000000000001', false)
ON CONFLICT (org_id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('a0a0a0a0-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner')
ON CONFLICT DO NOTHING;

-- ── workspaces + membership (Alice and Bob isolated) ─────────────────────
INSERT INTO public.workspaces (id, name, organization_id, created_by) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'Alice WS', 'a0a0a0a0-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-00000000000b', 'Bob WS',   'a0a0a0a0-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('b0000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'owner')
ON CONFLICT DO NOTHING;

-- ── Alice's project + main chat ──────────────────────────────────────────
INSERT INTO public.user_mini_apps (id, workspace_id, user_id, name) VALUES
  ('a1111111-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Alice App')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_chats (id, project_id, workspace_id, title, created_by, kind) VALUES
  ('a2222222-0000-0000-0000-0000000000a2', 'a1111111-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Main', '11111111-1111-1111-1111-111111111111', 'main')
ON CONFLICT (id) DO NOTHING;
