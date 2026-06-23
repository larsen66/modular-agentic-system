// src/server/loadEnv.ts — side-effect module. Import this FIRST (before any
// module that reads process.env) so .env is populated up front. tsx does not
// auto-load .env; without this the runner runs with Supabase unconfigured and
// silently falls back to the JSONL history path.
import { existsSync } from 'node:fs';

// (reloaded after wiring local SUPABASE_* into .env)
if (existsSync('.env')) {
  process.loadEnvFile('.env'); // Node 20.12+ built-in; no dependency.
}
