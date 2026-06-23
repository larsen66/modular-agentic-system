-- 0002_chat.sql
-- project_chats + chat_messages. The RLS policy bodies are copied 1:1 from
-- prod; only the bootstrap/backfill INSERTs (which assumed pre-existing prod
-- data) are dropped.
--
-- Prod sources:
--   project_chats               → 20260306171000_add_project_chats.sql
--   project_chats RLS           → 20260306172000_project_chats_rls.sql   (verbatim)
--   chat_messages + RLS         → 20260312080000_add_chat_messages.sql   (verbatim)

-- ── project_chats ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.user_mini_apps(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Main',
  created_by UUID REFERENCES auth.users(id),
  parent_chat_id UUID REFERENCES public.project_chats(id) ON DELETE SET NULL,
  source_chat_id UUID REFERENCES public.project_chats(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'branch', 'scratch', 'task-run')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  working_set JSONB DEFAULT '[]'::jsonb,
  last_message_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  last_sync_project_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_chats_project_id ON public.project_chats(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chats_workspace_id ON public.project_chats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_chats_created_by ON public.project_chats(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_chats_one_main_per_project
  ON public.project_chats(project_id) WHERE kind = 'main';

CREATE OR REPLACE FUNCTION public.update_project_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_chats_updated_at ON public.project_chats;
CREATE TRIGGER project_chats_updated_at
  BEFORE UPDATE ON public.project_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_project_chats_updated_at();

-- RLS — copied verbatim from 20260306172000_project_chats_rls.sql
ALTER TABLE public.project_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_member_select_chats" ON public.project_chats;
CREATE POLICY "workspace_member_select_chats" ON public.project_chats
  FOR SELECT USING (
    can_access_project(project_id, auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

DROP POLICY IF EXISTS "workspace_member_insert_chats" ON public.project_chats;
CREATE POLICY "workspace_member_insert_chats" ON public.project_chats
  FOR INSERT WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = project_chats.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'viewer'
    )
    AND COALESCE((get_org_role_for_workspace(workspace_id, auth.uid()))::text, '') <> 'viewer'
  );

DROP POLICY IF EXISTS "chat_owner_or_member_update" ON public.project_chats;
CREATE POLICY "chat_owner_or_member_update" ON public.project_chats
  FOR UPDATE USING (
    (created_by = auth.uid())
    OR (
      can_access_project(project_id, auth.uid())
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = project_chats.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'viewer'
      )
      AND COALESCE((get_org_role_for_workspace(workspace_id, auth.uid()))::text, '') <> 'viewer'
    )
  );

DROP POLICY IF EXISTS "chat_owner_or_member_delete" ON public.project_chats;
CREATE POLICY "chat_owner_or_member_delete" ON public.project_chats
  FOR DELETE USING (
    (created_by = auth.uid())
    OR (
      can_access_project(project_id, auth.uid())
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = project_chats.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'viewer'
      )
      AND COALESCE((get_org_role_for_workspace(workspace_id, auth.uid()))::text, '') <> 'viewer'
    )
  );

-- ── chat_messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.project_chats(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.user_mini_apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'error')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'done' CHECK (status IN ('sending', 'thinking', 'coding', 'streaming', 'done', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON public.chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created ON public.chat_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

CREATE OR REPLACE FUNCTION public.update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_messages_updated_at();

-- RLS — copied verbatim from 20260312080000_add_chat_messages.sql.
-- Note the INSERT WITH CHECK `user_id = auth.uid()`: a user can only write
-- messages AS THEMSELVES. The runner uses the service-role key, which bypasses
-- RLS, so it can insert assistant rows for any user.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_member_select_messages" ON public.chat_messages;
CREATE POLICY "project_member_select_messages" ON public.chat_messages
  FOR SELECT USING (
    can_access_project(project_id, auth.uid())
    OR has_platform_role(auth.uid(), 'platform_admin')
  );

DROP POLICY IF EXISTS "project_member_insert_messages" ON public.chat_messages;
CREATE POLICY "project_member_insert_messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    can_access_project(project_id, auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "message_owner_or_member_update" ON public.chat_messages;
CREATE POLICY "message_owner_or_member_update" ON public.chat_messages
  FOR UPDATE USING (
    user_id = auth.uid()
    OR can_access_project(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "message_owner_or_member_delete" ON public.chat_messages;
CREATE POLICY "message_owner_or_member_delete" ON public.chat_messages
  FOR DELETE USING (
    user_id = auth.uid()
    OR can_access_project(project_id, auth.uid())
  );

-- Realtime fanout (same as prod). Guarded so re-apply is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END;
$$;
