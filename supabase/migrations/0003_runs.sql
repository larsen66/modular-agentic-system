-- 0003_runs.sql
-- runs + run_events, consolidated to prod's FINAL state. The isolation core —
-- check_run_ownership + the tightened actor/visibility policies — is copied
-- 1:1 from prod (that is the whole point of this build).
--
-- Prod sources folded in here:
--   base runs/run_events + service-role write + RLS
--                              → 20260220300000_runs_history.sql
--   run_events.seq (replay)    → 20260404150000_run_events_table.sql
--   runs.admission jsonb       → 20260511145638_runs_admission_jsonb.sql
--   runs model identity cols   → 20260427114551_runs_model_identity_columns.sql
--   runs.chat_id               → 20260521210000_runs_chat_id_column.sql
--   check_run_ownership helper → 20260519030001_check_run_ownership_helper.sql (verbatim)
--   tightened base RLS         → 20260519030002_runs_workspace_read_tighten.sql (verbatim)
--   runs_user_visible view     → 20260519030003_runs_user_visible_view.sql (trimmed projections)

-- ── runs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.user_mini_apps(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id text,
  chat_id uuid REFERENCES public.project_chats(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Ownership identity for runs lives HERE (not a user_id column): the admission
  -- principal that admitted the run. check_run_ownership reads
  -- admission #>> '{principal,requested_by_user_id}'.
  admission jsonb,
  provider text,
  model text,
  effort_id text,
  intent_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── run_events (ordered event stream for SSE replay) ─────────────────────
CREATE TABLE IF NOT EXISTS public.run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  event text NOT NULL,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'runner', 'docker', 'user', 'preview')),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  seq integer DEFAULT 0,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON public.runs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON public.runs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_chat ON public.runs(chat_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_events_run ON public.run_events(run_id, ts ASC);
CREATE INDEX IF NOT EXISTS idx_run_events_run_seq ON public.run_events(run_id, seq);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;

-- Service-role write bypass (the runner writes as service_role). Verbatim prod.
DROP POLICY IF EXISTS runs_service_write ON public.runs;
CREATE POLICY runs_service_write ON public.runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS run_events_service_write ON public.run_events;
CREATE POLICY run_events_service_write ON public.run_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- check_run_ownership — THE isolation predicate. Copied 1:1 from
-- 20260519030001_check_run_ownership_helper.sql. SECURITY DEFINER is REQUIRED:
-- it is invoked BY the runs/run_events policies, so it must bypass RLS at
-- depth 1 to read runs.admission + workspace_members/org_settings without
-- re-triggering the policies that called it.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_run_ownership(p_run_id uuid, p_caller uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.runs r
    WHERE r.id = p_run_id
      AND (
        -- Actor clause: caller is the admission principal that admitted the run.
        (
          p_caller IS NOT NULL
          AND r.admission IS NOT NULL
          AND r.admission #>> '{principal,requested_by_user_id}' IS NOT NULL
          AND public.is_uuid(r.admission #>> '{principal,requested_by_user_id}')
          AND (r.admission #>> '{principal,requested_by_user_id}')::uuid = p_caller
        )
        OR
        -- Workspace-visibility clause: caller is a workspace_member of the run's
        -- workspace AND that workspace's org has workspace_run_visibility = true.
        EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          JOIN public.org_settings os ON os.org_id = w.organization_id
          WHERE wm.workspace_id = r.workspace_id
            AND wm.user_id = p_caller
            AND os.workspace_run_visibility = true
          LIMIT 1
        )
      )
    LIMIT 1
  );
$$;

REVOKE ALL ON FUNCTION public.check_run_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_run_ownership(uuid, uuid) TO authenticated;

-- SECURITY DEFINER display-name resolver (so a security_invoker view can
-- project display_name without the caller's role having SELECT on auth.users).
CREATE OR REPLACE FUNCTION public.resolve_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT u.raw_user_meta_data->>'display_name'
  FROM auth.users u WHERE u.id = p_user_id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_user_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_display_name(uuid) TO authenticated;

-- Tightened base-table read policies — verbatim from
-- 20260519030002_runs_workspace_read_tighten.sql. Only the admission actor OR
-- a workspace member with workspace_run_visibility=true may read.
DROP POLICY IF EXISTS runs_actor_or_visible_workspace_read ON public.runs;
CREATE POLICY runs_actor_or_visible_workspace_read ON public.runs
  FOR SELECT USING (public.check_run_ownership(id, auth.uid()));

DROP POLICY IF EXISTS run_events_actor_or_visible_workspace_read ON public.run_events;
CREATE POLICY run_events_actor_or_visible_workspace_read ON public.run_events
  FOR SELECT USING (public.check_run_ownership(run_id, auth.uid()));

-- ── runs_user_visible view (trimmed projection set) ──────────────────────
-- security_invoker = on → the WHERE clause's check_run_ownership(r.id, auth.uid())
-- evaluates under the CALLER's identity, so RLS-equivalent gating applies.
CREATE OR REPLACE VIEW public.runs_user_visible
WITH (security_invoker = on) AS
  SELECT
    r.id,
    r.project_id,
    r.workspace_id,
    r.session_id,
    r.chat_id,
    r.status,
    r.started_at,
    r.ended_at,
    r.duration_ms,
    r.summary,
    r.provider,
    r.model,
    r.effort_id,
    r.intent_label,
    -- NULL when the caller is the actor; otherwise the other actor's UUID (for UI labels).
    CASE
      WHEN r.admission #>> '{principal,requested_by_user_id}' IS NOT NULL
        AND public.is_uuid(r.admission #>> '{principal,requested_by_user_id}')
        AND (r.admission #>> '{principal,requested_by_user_id}')::uuid = auth.uid()
      THEN NULL
      WHEN r.admission #>> '{principal,requested_by_user_id}' IS NOT NULL
        AND public.is_uuid(r.admission #>> '{principal,requested_by_user_id}')
      THEN (r.admission #>> '{principal,requested_by_user_id}')::uuid
      ELSE NULL
    END AS owned_by_other_user_id,
    CASE
      WHEN r.admission #>> '{principal,requested_by_user_id}' IS NOT NULL
        AND public.is_uuid(r.admission #>> '{principal,requested_by_user_id}')
      THEN public.resolve_user_display_name((r.admission #>> '{principal,requested_by_user_id}')::uuid)
      ELSE NULL
    END AS collaborator_display_name
  FROM public.runs r
  WHERE public.check_run_ownership(r.id, auth.uid());

GRANT SELECT ON public.runs_user_visible TO authenticated;
