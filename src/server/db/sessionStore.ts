// src/server/db/sessionStore.ts
// Service-role WRITE path for session continuity (opencode_sessions). The frontend's
// fetchProjectStatuses reads this table for the Explorer project-health dot, and it records which
// engine/session a chat used. The kernel's synthetic sessionId is a non-uuid string, so we key the
// row on the TEXT column `opencode_session_id` (not the uuid PK `id`) via select-or-insert — no DB
// unique constraint required.
// MODULAR: `engine_ref` stores the harness verbatim; the environment rides in metadata on the run.
// Nothing branches on harness/env.

import { admin } from '../supabase.js';

export interface EnsureSessionInput {
  sessionId: string; // kernel synthetic id → stored in opencode_session_id (text)
  ownerId: string;
  projectId?: string | null;
  hostWorkspaceId?: string | null;
  engineRef: string; // harness ref (pi / opencode / claude-agent-sdk / …)
  /** surface_key is NOT NULL in opencode_sessions. We namespace under `kernel:` so kernel session
   *  rows never collide with the real runner-service's surface keys on the shared BOS project. */
  surfaceKey: string;
}

async function findRowId(sessionId: string): Promise<string | null> {
  const { data } = await admin()
    .from('opencode_sessions')
    .select('id')
    .eq('opencode_session_id', sessionId)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

// Upsert-by-text-key: create the session row on first run, else mark it active. Best-effort.
export async function ensureSession(input: EnsureSessionInput): Promise<void> {
  const nowIso = new Date().toISOString();
  const existing = await findRowId(input.sessionId);
  if (existing) {
    const { error } = await admin()
      .from('opencode_sessions')
      .update({ status: 'active', last_active_at: nowIso })
      .eq('id', existing);
    if (error) throw new Error(`[sessionStore] update failed: ${error.message}`);
    return;
  }
  const { error } = await admin().from('opencode_sessions').insert({
    user_id: input.ownerId,
    project_id: input.projectId ?? null,
    host_workspace_id: input.hostWorkspaceId ?? null,
    owner_workspace_id: input.hostWorkspaceId ?? null,
    surface_key: input.surfaceKey,
    engine_ref: input.engineRef,
    opencode_session_id: input.sessionId,
    status: 'active',
    message_count: 0,
    last_active_at: nowIso,
  });
  if (error) throw new Error(`[sessionStore] insert failed: ${error.message}`);
}

// Increment the session's message tally + touch last_active_at after a run settles. Best-effort.
export async function bumpSession(sessionId: string, by: number): Promise<void> {
  const { data } = await admin()
    .from('opencode_sessions')
    .select('id,message_count')
    .eq('opencode_session_id', sessionId)
    .limit(1)
    .maybeSingle();
  if (!data) return;
  const { error } = await admin()
    .from('opencode_sessions')
    .update({ message_count: (data.message_count ?? 0) + by, last_active_at: new Date().toISOString() })
    .eq('id', data.id as string);
  if (error) throw new Error(`[sessionStore] bump failed: ${error.message}`);
}
