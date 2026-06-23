// src/server/db/historyRead.ts
// RLS-scoped READ path. Every query here runs under the CALLER's JWT, so the
// same check_run_ownership predicate that protects prod gates these reads —
// the runner adds NO server-side ownerId filter. If RLS would hide a row, the
// query simply returns fewer rows. That is the isolation guarantee, proven by
// construction rather than by a hand-written WHERE clause.
//
// `runs_user_visible` is the view created in 0003_runs.sql with
// security_invoker = on; selecting from it as the user yields exactly the runs
// they may see (own runs + workspace-visible runs).

import { asUser } from '../supabase.js';

export interface ProjectItem {
  id: string;
  name: string;
  workspace_id: string;
}

// Projects the caller may access, RLS-scoped (user_mini_apps RLS / membership).
// Bob sees none of Alice's projects — project-level isolation, same mechanism.
export async function listProjectsForUser(jwt: string): Promise<ProjectItem[]> {
  const { data, error } = await asUser(jwt)
    .from('user_mini_apps')
    .select('id,name,workspace_id')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[historyRead] projects failed: ${error.message}`);
  return (data ?? []) as ProjectItem[];
}

export interface RunListItem {
  id: string;
  project_id: string;
  workspace_id: string;
  session_id: string | null;
  chat_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  provider: string | null;
  model: string | null;
  summary?: Record<string, unknown> | null;
  owned_by_other_user_id: string | null;
  collaborator_display_name: string | null;
}

// List runs visible to the caller (newest first), via the RLS view.
export async function listRunsForUser(jwt: string): Promise<RunListItem[]> {
  const { data, error } = await asUser(jwt)
    .from('runs_user_visible')
    .select(
      'id,project_id,workspace_id,session_id,chat_id,status,started_at,ended_at,duration_ms,provider,model,summary,owned_by_other_user_id,collaborator_display_name'
    )
    .order('started_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`[historyRead] list failed: ${error.message}`);
  return (data ?? []) as RunListItem[];
}

// One run + its ordered event stream, both RLS-gated. Returns null when the
// caller may not see the run (RLS returns zero rows) — the route renders 404,
// never leaking existence.
export async function getRunForUser(
  jwt: string,
  runId: string
): Promise<{ run: RunListItem; events: unknown[] } | null> {
  const client = asUser(jwt);
  const { data: run, error: runErr } = await client
    .from('runs_user_visible')
    .select(
      'id,project_id,workspace_id,session_id,chat_id,status,started_at,ended_at,duration_ms,provider,model,summary,owned_by_other_user_id,collaborator_display_name'
    )
    .eq('id', runId)
    .maybeSingle();
  if (runErr) throw new Error(`[historyRead] get run failed: ${runErr.message}`);
  if (!run) return null;

  // run_events RLS (run_events_actor_or_visible_workspace_read) applies the same
  // predicate, so this is safe under the caller's JWT.
  const { data: events, error: evErr } = await client
    .from('run_events')
    .select('event,source,level,data,seq,ts')
    .eq('run_id', runId)
    .order('seq', { ascending: true });
  if (evErr) throw new Error(`[historyRead] get events failed: ${evErr.message}`);

  return { run: run as RunListItem, events: events ?? [] };
}
