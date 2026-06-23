-- 0004_tenancy_rls.sql
-- Enable RLS on the tenancy graph. Without this, `authenticated` can read every
-- row of user_mini_apps / workspaces / members (project- and workspace-level
-- isolation leak — Bob would see Alice's projects via /projects). Prod has RLS
-- on all of these; this restores that.
--
-- SAFE w.r.t. the run/chat predicates: can_access_project, is_workspace_member,
-- check_run_ownership are all SECURITY DEFINER, so their internal reads of these
-- tables BYPASS RLS and do not recurse. service_role (BYPASSRLS) keeps full
-- write/read for the runner.

-- ── projects ───────────────────────────────────────────────────────────────
ALTER TABLE public.user_mini_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_mini_apps_member_select ON public.user_mini_apps;
CREATE POLICY user_mini_apps_member_select ON public.user_mini_apps
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

-- ── workspaces ─────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspaces_member_select ON public.workspaces;
CREATE POLICY workspaces_member_select ON public.workspaces
  FOR SELECT USING (
    is_workspace_member(id, auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

-- ── workspace_members ──────────────────────────────────────────────────────
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_members_self_or_comember_select ON public.workspace_members;
CREATE POLICY workspace_members_self_or_comember_select ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_workspace_member(workspace_id, auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

-- ── organizations / membership / settings ──────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
CREATE POLICY organizations_member_select ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_members_self_select ON public.organization_members;
CREATE POLICY organization_members_self_select ON public.organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_settings_member_select ON public.org_settings;
CREATE POLICY org_settings_member_select ON public.org_settings
  FOR SELECT USING (
    org_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

-- ── profiles / platform_roles ───────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_roles_self_select ON public.platform_roles;
CREATE POLICY platform_roles_self_select ON public.platform_roles
  FOR SELECT USING (user_id = auth.uid());
