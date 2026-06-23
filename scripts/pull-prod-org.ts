// scripts/pull-prod-org.ts
// One-off: copy a single user's OWN org graph from prod Supabase into the local
// stack, scoped strictly to that user's identity (no other tenants' rows).
// Read-only against prod (BOS_SUPABASE_*); writes only to local (SUPABASE_*).
//
// Bridge note: prod grants workspace access via workspaces.owner_id, but the
// local schema's RLS resolves membership via workspace_members. So for each
// copied workspace we SYNTHESISE a workspace_members(owner) row for the user —
// otherwise local RLS would hide the user's own data.
//
// Run: tsx scripts/pull-prod-org.ts dav.hakobyan100@gmail.com
import './../src/server/loadEnv.js';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.argv[2] ?? 'dav.hakobyan100@gmail.com';

const prod = createClient(env('BOS_SUPABASE_URL'), env('BOS_SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const local = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function env(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`missing env ${n}`);
  return v;
}
const inSet = <T>(v: T, allowed: T[], fallback: T): T => (allowed.includes(v) ? v : fallback);

// Page through a `col IN (ids)` select in 1000-row windows (PostgREST max_rows)
// so large tables (run_events) are copied in FULL, never silently truncated.
async function pagedIn(table: string, col: string, ids: string[]): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await prod
      .from(table)
      .select('*')
      .in(col, ids)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function main() {
  // 1. resolve the user in prod
  const { data: prof } = await prod.from('profiles').select('*').eq('email', EMAIL).single();
  if (!prof) throw new Error(`no prod profile for ${EMAIL}`);
  const uid = prof.id as string;
  console.log(`user ${EMAIL} → ${uid}`);

  // 2. org graph (scoped to this user)
  const { data: memberships } = await prod.from('organization_members').select('*').eq('user_id', uid);
  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id as string))];
  const { data: orgs } = await prod.from('organizations').select('*').in('id', orgIds);
  const { data: workspaces } = await prod.from('workspaces').select('*').in('organization_id', orgIds);
  const wsIds = (workspaces ?? []).map((w) => w.id as string);
  const { data: projects } = await prod.from('user_mini_apps').select('*').in('workspace_id', wsIds);
  const projIds = (projects ?? []).map((p) => p.id as string);
  const { data: chats } = await prod.from('project_chats').select('*').in('project_id', projIds);
  const { data: messages } = await prod.from('chat_messages').select('*').in('project_id', projIds);
  const { data: runs } = await prod.from('runs').select('*').in('project_id', projIds);
  const runIds = (runs ?? []).map((r) => r.id as string);
  // run_events can exceed PostgREST's max_rows (1000) — page through ALL of them
  // so we never silently truncate the event history.
  const events = runIds.length ? await pagedIn('run_events', 'run_id', runIds) : [];

  console.log(
    `prod: ${orgs?.length ?? 0} orgs · ${workspaces?.length ?? 0} ws · ${projects?.length ?? 0} projects · ` +
      `${chats?.length ?? 0} chats · ${messages?.length ?? 0} msgs · ${runs?.length ?? 0} runs · ${events?.length ?? 0} events`
  );

  // 3. write to local in FK order (service role bypasses RLS). Idempotent upserts.
  await up('organizations', (orgs ?? []).map((o) => ({
    id: o.id, name: o.name, created_by: uidOrNull(o.created_by, uid), created_at: o.created_at,
  })));

  await up('org_settings', orgIds.map((id) => ({ org_id: id, workspace_run_visibility: false })), 'org_id');

  await up('organization_members', (memberships ?? []).map((m) => ({
    organization_id: m.organization_id, user_id: m.user_id, role: inSet(m.role, ['owner', 'admin', 'member', 'viewer'], 'member'),
  })), 'organization_id,user_id');

  await up('workspaces', (workspaces ?? []).map((w) => ({
    id: w.id, name: w.name, organization_id: w.organization_id, created_by: uidOrNull(w.created_by, uid), created_at: w.created_at,
  })));

  // SYNTH membership bridge: prod uses owner_id, local RLS uses workspace_members.
  await up('workspace_members', wsIds.map((ws) => ({ workspace_id: ws, user_id: uid, role: 'owner' })), 'workspace_id,user_id');

  await up('user_mini_apps', (projects ?? []).map((p) => ({
    id: p.id, workspace_id: p.workspace_id, user_id: uidOrNull(p.user_id, uid), name: p.name ?? 'app', created_at: p.created_at,
  })));

  await up('project_chats', (chats ?? []).map((c) => ({
    id: c.id, project_id: c.project_id, workspace_id: c.workspace_id, title: c.title ?? 'Main',
    created_by: uidOrNull(c.created_by, uid), kind: inSet(c.kind, ['main', 'branch', 'scratch', 'task-run'], 'main'),
    status: inSet(c.status, ['active', 'paused', 'archived'], 'active'),
    messages: c.messages ?? [], created_at: c.created_at,
  })));

  await up('chat_messages', (messages ?? []).map((m) => ({
    id: m.id, chat_id: m.chat_id, project_id: m.project_id,
    user_id: m.user_id === uid ? uid : null, // only this user exists locally
    role: inSet(m.role, ['user', 'assistant', 'system', 'error'], 'system'),
    content: m.content ?? '', status: inSet(m.status, ['sending', 'thinking', 'coding', 'streaming', 'done', 'error'], 'done'),
    metadata: m.metadata ?? {}, created_at: m.created_at,
  })));

  await up('runs', (runs ?? []).map((r) => ({
    id: r.id, project_id: r.project_id, workspace_id: r.workspace_id, session_id: r.session_id ?? null,
    chat_id: r.chat_id ?? null, status: mapRunStatus(r.status, r.ended_at),
    started_at: r.started_at ?? r.created_at, ended_at: r.ended_at ?? null, duration_ms: r.duration_ms ?? null,
    summary: r.summary ?? {}, admission: r.admission ?? null, provider: r.provider ?? null, model: r.model ?? null,
    effort_id: r.effort_id ?? null, intent_label: r.intent_label ?? null, created_at: r.created_at,
  })));

  await up('run_events', (events ?? []).map((e) => ({
    id: e.id, run_id: e.run_id, event: e.event ?? 'event',
    source: inSet(e.source, ['system', 'runner', 'docker', 'user', 'preview'], 'system'),
    level: inSet(e.level, ['info', 'warn', 'error', 'debug'], 'info'),
    data: e.data ?? {}, seq: e.seq ?? 0, ts: e.ts,
  })));

  console.log('done.');
}

function uidOrNull(v: unknown, uid: string): string | null {
  return v === uid ? uid : v == null ? null : (v as string);
}
function mapRunStatus(s: string, ended: unknown): string {
  if (['started', 'running', 'succeeded', 'failed'].includes(s)) return s;
  if (['completed', 'complete', 'done', 'success'].includes(s)) return 'succeeded';
  if (['cancelled', 'canceled', 'error', 'errored'].includes(s)) return 'failed';
  if (['queued', 'pending'].includes(s)) return 'started';
  if (['in_progress', 'active'].includes(s)) return 'running';
  return ended ? 'succeeded' : 'running';
}

// Upsert a batch, reporting count + any error. onConflict default 'id'.
async function up(table: string, rows: Record<string, unknown>[], onConflict = 'id') {
  if (rows.length === 0) {
    console.log(`  ${table}: 0`);
    return;
  }
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await local.from(table).upsert(slice, { onConflict, ignoreDuplicates: false });
    if (error) {
      console.error(`  ${table}: ERROR ${error.message}`);
      throw error;
    }
  }
  console.log(`  ${table}: ${rows.length} upserted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
