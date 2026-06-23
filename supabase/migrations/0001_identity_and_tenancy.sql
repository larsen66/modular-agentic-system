-- 0001_identity_and_tenancy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Faithful, minimal reproduction of the prod tenancy graph that the chat/runs
-- RLS policies depend on. The POLICY TEXT in 0002/0003 is copied 1:1 from prod;
-- this file provides the smallest membership backing those policies need to
-- execute, instead of replaying prod's ~15 evolved access migrations + the
-- pg_dump base.
--
-- Prod source of the shapes reproduced here:
--   workspaces / workspace_members / has_platform_role
--     → supabase/migrations/20260218200000_access_hierarchy.sql
--   organizations / organization_members
--     → supabase/migrations/20260220120000_org_tables.sql
--   org_settings (+ workspace_run_visibility)
--     → supabase/migrations/20260519030000_org_settings_workspace_run_visibility.sql
--   can_access_project / is_workspace_member / get_org_role_for_workspace
--     → the latest cutovers (20260604035000_project_chat_surface_access_helpers.sql,
--       20260323110000_ws_project_helper_cutover_to_node_memberships.sql).
--       Here they are collapsed to a single readable membership predicate.
--
-- DELIBERATE SIMPLIFICATION vs prod (documented in ISOLATION.md):
--   * `can_access_project` = workspace membership OR platform_admin, NOT the
--     full node_memberships / direct-ACL / org-sharing graph.
--   * `workspace_members.role` includes 'viewer' so the prod policy text
--     (`role = 'viewer'`) executes verbatim; in prod 'viewer' arrives via the
--     org-role layer (get_org_role_for_workspace).
-- The ISOLATION SEMANTICS (who can read whose runs/chats) are identical.
-- ─────────────────────────────────────────────────────────────────────────

-- auth.users, auth.uid(), gen_random_uuid() are provided by the local Supabase
-- stack — no extension bootstrap needed.

-- PG-version-portable uuid validator. Prod uses pg_input_is_valid(x,'uuid')
-- (PG16+); its own migration comment (20260519030001) prescribes this exact
-- regex substitution for PG15. Using a named helper keeps 0003 readable and lets
-- this build run on either major version.
CREATE OR REPLACE FUNCTION public.is_uuid(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
$$;

-- ── profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── organizations / membership / settings ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Per-org config bag. Mirrors prod's org_settings; the only column the runs
-- isolation predicate reads is `workspace_run_visibility`.
CREATE TABLE IF NOT EXISTS public.org_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_run_visibility boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.org_settings.workspace_run_visibility IS
  'When true, workspace members can see ALL runs of apps in the workspace '
  '(not just their own). Default false = owner-only. Read by check_run_ownership. '
  'Prod source: 20260519030000_org_settings_workspace_run_visibility.sql';

-- ── workspaces / membership ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  personal_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'viewer' added vs prod's {owner,admin,member} so the prod chat policy text
  -- (`role = 'viewer'`) runs 1:1 here. See header note.
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- ── platform roles (for has_platform_role) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_admin', 'support')),
  PRIMARY KEY (user_id, role)
);

-- ── projects (user_mini_apps) ────────────────────────────────────────────
-- Minimal shape: only the columns the isolation graph + run FKs reference.
CREATE TABLE IF NOT EXISTS public.user_mini_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'app',
  chat_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mini_apps_workspace ON public.user_mini_apps(workspace_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Membership helper functions. All SECURITY DEFINER so they can be invoked
-- FROM RLS policies without re-entering those policies (same rationale prod
-- documents in 20260519030001_check_run_ownership_helper.sql).
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_platform_role(p_user uuid, p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = p_user AND pr.role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace AND wm.user_id = p_user
  );
$$;

-- Returns the caller's effective role in a workspace. Prod resolves this via
-- the org-role layer; here it is the workspace_members.role directly, which is
-- all the chat policies' `<> 'viewer'` checks need.
CREATE OR REPLACE FUNCTION public.get_org_role_for_workspace(p_workspace uuid, p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT wm.role FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace AND wm.user_id = p_user
  LIMIT 1;
$$;

-- Can the caller access this project? = member of the project's workspace,
-- OR a platform_admin. (Prod additionally honours node-level ACLs and org
-- sharing; collapsed here — see ISOLATION.md.)
CREATE OR REPLACE FUNCTION public.can_access_project(p_project uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_mini_apps a
    JOIN public.workspace_members wm
      ON wm.workspace_id = a.workspace_id AND wm.user_id = p_user
    WHERE a.id = p_project
  ) OR public.has_platform_role(p_user, 'platform_admin');
$$;

REVOKE ALL ON FUNCTION public.has_platform_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_org_role_for_workspace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_role_for_workspace(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO authenticated;
