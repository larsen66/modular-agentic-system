// src/server/supabase.ts
// Two Supabase client factories, mirroring prod's split:
//   - admin (service_role): BYPASSES RLS. The runner writes runs/run_events/
//     chat_messages as service_role (prod: runner-service/src/supabaseAdmin.ts).
//   - user (anon key + caller JWT): RLS-SCOPED. History reads go through this so
//     the SAME check_run_ownership predicate gates the runner exactly as it
//     gates the prod Studio (prod: src/integrations/supabase/client.ts).
//
// Env (local Supabase defaults are printed by `supabase start`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[supabase] missing env ${name}`);
  return v;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let _admin: SupabaseClient | null = null;
// Service-role client. Singleton — no per-request user context, so it is safe
// to reuse. NEVER expose its key or hand it a user JWT.
export function admin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(reqEnv('SUPABASE_URL'), reqEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

// Per-request RLS-scoped client. The caller's JWT rides in the Authorization
// header so Postgres sees `auth.uid()` = the caller and evaluates RLS / the
// runs_user_visible view under their identity. Do NOT cache across users.
export function asUser(jwt: string): SupabaseClient {
  return createClient(reqEnv('SUPABASE_URL'), reqEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Email/password login proxied to GoTrue, so the Studio never holds Supabase
// keys — it logs in through the runner and gets back a JWT. Returns the token +
// minimal user identity, or throws on bad credentials.
export async function passwordLogin(
  email: string,
  password: string
): Promise<{ accessToken: string; user: { id: string; email: string } }> {
  const url = reqEnv('SUPABASE_URL');
  const anon = reqEnv('SUPABASE_ANON_KEY');
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('invalid credentials');
  const json = (await res.json()) as { access_token?: string; user?: { id: string; email: string } };
  if (!json.access_token || !json.user) throw new Error('login failed');
  return { accessToken: json.access_token, user: { id: json.user.id, email: json.user.email } };
}
