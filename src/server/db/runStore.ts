// src/server/db/runStore.ts
// Service-role WRITE path for run history — the Supabase replacement for the
// JSONL RunRecorder. Mirrors prod runner-service/src/runs/persistence.ts:
//   - identity is stamped into runs.admission.principal.requested_by_user_id
//     (NOT a user_id column) — that is what check_run_ownership reads.
//   - run_events get a monotonic `seq` for ordered SSE replay.
//   - all writes use the service_role client, which bypasses RLS.

import { admin } from '../supabase.js';
import type { EngineEvent } from '../../types/index.js';
import type { RunResult } from '../../kernel/index.js';

// Per-run monotonic sequence allocator (prod: allocateRunSeq). In-process is
// sufficient for the single-runner reference build.
const seqCounters = new Map<string, number>();
function nextSeq(runId: string): number {
  const n = (seqCounters.get(runId) ?? 0) + 1;
  seqCounters.set(runId, n);
  return n;
}

export interface CreateRunInput {
  runId: string;
  ownerId: string; // the admission principal
  projectId: string;
  workspaceId?: string; // resolved from the project when omitted
  sessionId: string;
  chatId?: string | null;
  model?: string | null;
  provider?: string | null;
}

// Resolve a project's workspace_id via service_role (the runs FK requires it).
async function resolveWorkspaceId(projectId: string): Promise<string> {
  const { data, error } = await admin()
    .from('user_mini_apps')
    .select('workspace_id')
    .eq('id', projectId)
    .single();
  if (error || !data) throw new Error(`[runStore] project ${projectId} not found: ${error?.message}`);
  return data.workspace_id as string;
}

// Insert the run row at admission time. Returns the workspaceId used (so the
// caller can thread it through). Best-effort: a persistence failure must never
// break a live run, so the server catches.
export async function createRun(input: CreateRunInput): Promise<{ workspaceId: string }> {
  const workspaceId = input.workspaceId ?? (await resolveWorkspaceId(input.projectId));
  const { error } = await admin().from('runs').insert({
    id: input.runId,
    project_id: input.projectId,
    workspace_id: workspaceId,
    session_id: input.sessionId,
    chat_id: input.chatId ?? null,
    status: 'running',
    provider: input.provider ?? null,
    model: input.model ?? null,
    // The ownership identity. Shaped exactly like prod so check_run_ownership's
    // admission #>> '{principal,requested_by_user_id}' resolves.
    admission: { run_id: input.runId, principal: { requested_by_user_id: input.ownerId } },
  });
  if (error) throw new Error(`[runStore] createRun failed: ${error.message}`);
  return { workspaceId };
}

// Map an EngineEvent → run_events row level. Coarse, matches the prod CHECK set.
function levelFor(ev: EngineEvent): 'info' | 'warn' | 'error' {
  if (ev.type === 'terminal') return ev.cause === 'error' ? 'error' : 'info';
  if (ev.type === 'log') return ev.level;
  if (ev.type === 'tool_result' && !ev.ok) return 'warn';
  return 'info';
}

// Append one streamed event. Fire-and-forget from the tee; ordering is by seq,
// not await order, so callers need not serialize.
export async function appendRunEvent(runId: string, ev: EngineEvent): Promise<void> {
  const { error } = await admin().from('run_events').insert({
    run_id: runId,
    event: ev.type,
    source: 'runner',
    level: levelFor(ev),
    data: ev as unknown as Record<string, unknown>,
    seq: nextSeq(runId),
  });
  if (error) throw new Error(`[runStore] appendRunEvent failed: ${error.message}`);
}

// Settle the run row: terminal status + usage/cost summary + model identity.
export async function completeRun(runId: string, result: RunResult, startedAtMs: number): Promise<void> {
  const status = result.cause === 'error' ? 'failed' : 'succeeded';
  const { error } = await admin()
    .from('runs')
    .update({
      status,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAtMs,
      summary: {
        cause: result.cause,
        finalText: result.finalText,
        usage: result.usage,
        cost: result.cost,
        ...(result.error ? { error: result.error } : {}),
      },
    })
    .eq('id', runId);
  if (error) throw new Error(`[runStore] completeRun failed: ${error.message}`);
  seqCounters.delete(runId);
}
