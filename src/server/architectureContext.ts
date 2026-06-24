import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ENV_FILES, loadHarnessEnv } from './harnessEnv.js';

export interface ArchitectureContext {
  generatedAt: string;
  runtime: {
    harnesses: string[];
    environments: string[];
    readyPairs: string[];
    envFiles: { label: string; exists: boolean }[];
    credentials: {
      openRouter: boolean;
      openAiApiKey: boolean;
      e2b: boolean;
      daytona: boolean;
      codesandbox: boolean;
      vercel: boolean;
    };
    modelGateway: {
      provider: 'openrouter' | 'openai' | 'unconfigured';
      baseUrl: string | null;
      model: string | null;
    };
  };
  bos: {
    configured: boolean;
    authMode: 'none' | 'jwt' | 'service_email';
    status: 'offline' | 'needs_auth' | 'ready' | 'error';
    projectUrl: string | null;
    user: Record<string, unknown> | null;
    counts: Record<string, number>;
    rows: Record<string, Record<string, unknown>[]>;
    warnings: string[];
  };
}

interface BosConfig {
  url: string | null;
  anonKey: string | null;
  serviceKey: string | null;
}

const PROFILE_SELECT = 'id,email,full_name,avatar_url,username,bio,created_at,updated_at,github_connected,github_username,onboarding_completed,email_verified';
const ORGANIZATION_SELECT = 'id,name,created_by,created_at,description,slug,is_platform_default,learning_execution_mode,default_member_role,allow_self_registration';
const WORKSPACE_SELECT = 'id,name,slug,created_by,created_at,updated_at,owner_id,organization_id,description';
const APP_SELECT = 'id,user_id,name,description,icon,type,prompt,is_public,created_at,updated_at,workspace_id,current_version,is_private,entity_type,github_repo_url';
const CHAT_SELECT = 'id,project_id,workspace_id,title,created_by,parent_chat_id,source_chat_id,kind,status,summary,last_message_at,last_activity_at,created_at,updated_at,opencode_session_id,runner_session_id';
const MESSAGE_SELECT = 'id,chat_id,message_type,created_at,updated_at,project_id,user_id,role,status,session_id';
const RUN_SELECT = 'id,project_id,workspace_id,session_id,status,started_at,ended_at,duration_ms,outcome_label,provider,model,input_tokens,output_tokens,terminal_cause,engine_id,requested_provider,requested_model';
const ORG_SETTINGS_SELECT = 'org_id';

// The verified-ready (harness × environment) compatibility matrix. Surfaced by
// /registry so the Studio dropdowns can highlight which counterparts pair with
// the current selection. Format: 'harnessRef x envRef'.
export const READY_PAIRS = [
  'openai-agents x docker',
  'openai-agents x e2b',
  'openai-agents x daytona',
  'openai-agents x codesandbox',
  'claude-agent-sdk x docker',
  'claude-agent-sdk x e2b',
  'claude-agent-sdk x daytona',
  'claude-agent-sdk x codesandbox',
  'hermes-cli x local',
  'hermes-cli x docker',
  'hermes-cli x e2b',
  'hermes-cli x daytona',
  'hermes-cli x codesandbox',
  'claude-cli x local',
  'codex-cli x local',
  'opencode x local',
];

const REST_LIMIT = 20;

function runtimeContext(harnesses: string[], environments: string[]): ArchitectureContext['runtime'] {
  const fileSet = Array.from(new Set(DEFAULT_ENV_FILES.map((filePath) => path.resolve(filePath))));
  const loaded = loadHarnessEnv(fileSet);
  const env = (name: string): string | null => {
    const value = process.env[name] || loaded[name];
    return value && value.trim() ? value.trim() : null;
  };

  const openRouter = env('OPENROUTER_API_KEY') || env('OPENROUTER');
  const openAiApiKey = env('OPENAI_API_KEY') || openRouter;
  const baseUrl = env('OPENAI_BASE_URL') || (openRouter ? 'https://openrouter.ai/api/v1' : null);
  const model = env('OPENAI_AGENTS_MODEL') || (openRouter ? 'openai/gpt-4o-mini' : null);

  return {
    harnesses,
    environments,
    readyPairs: READY_PAIRS,
    envFiles: fileSet.map((filePath) => ({
      label: path.relative(process.cwd(), filePath) || path.basename(filePath),
      exists: fs.existsSync(filePath),
    })),
    credentials: {
      openRouter: Boolean(openRouter),
      openAiApiKey: Boolean(openAiApiKey),
      e2b: Boolean(env('E2B_API_KEY') || env('E2B')),
      daytona: Boolean(env('DAYTONA_API_KEY') || env('Daytona')),
      codesandbox: Boolean(env('CSB_API_KEY')),
      vercel: Boolean(env('VERCEL_TOKEN') || env('Vercel')),
    },
    modelGateway: {
      provider: openRouter ? 'openrouter' : openAiApiKey ? 'openai' : 'unconfigured',
      baseUrl,
      model,
    },
  };
}

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function readBosConfig(): BosConfig {
  return {
    url: firstEnv('BOS_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL'),
    anonKey: firstEnv('BOS_SUPABASE_ANON_KEY', 'BOS_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    serviceKey: firstEnv('BOS_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function fetchJson<T>(
  url: string,
  key: string,
  authToken: string,
  warnings: string[]
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      warnings.push(`${res.status} ${new URL(url).pathname}: ${text.slice(0, 180)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    warnings.push(`request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : [];
}

function ids(rows: Record<string, unknown>[], key = 'id'): string[] {
  return rows.map((row) => row[key]).filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function inFilter(values: string[]): string {
  return `in.(${values.join(',')})`;
}

async function restRows(
  baseUrl: string,
  key: string,
  authToken: string,
  path: string,
  warnings: string[]
): Promise<Record<string, unknown>[]> {
  return asRows(await fetchJson<unknown>(`${baseUrl}/rest/v1/${path}`, key, authToken, warnings));
}

async function resolveUserByJwt(
  baseUrl: string,
  anonKey: string,
  jwt: string,
  warnings: string[]
): Promise<Record<string, unknown> | null> {
  return fetchJson<Record<string, unknown>>(`${baseUrl}/auth/v1/user`, anonKey, jwt, warnings);
}

async function resolveUserByEmail(
  baseUrl: string,
  serviceKey: string,
  email: string,
  warnings: string[]
): Promise<Record<string, unknown> | null> {
  const rows = await restRows(
    baseUrl,
    serviceKey,
    serviceKey,
    `profiles?select=${PROFILE_SELECT}&email=eq.${encodeURIComponent(email)}&limit=1`,
    warnings
  );
  return rows[0] ?? null;
}

function makeEmptyContext(harnesses: string[], environments: string[], warnings: string[]): ArchitectureContext {
  const cfg = readBosConfig();
  return {
    generatedAt: new Date().toISOString(),
    runtime: runtimeContext(harnesses, environments),
    bos: {
      configured: Boolean(cfg.url && cfg.anonKey),
      authMode: 'none',
      status: cfg.url && cfg.anonKey ? 'needs_auth' : 'offline',
      projectUrl: cfg.url ? normalizeUrl(cfg.url) : null,
      user: null,
      counts: {},
      rows: {},
      warnings,
    },
  };
}

export async function buildArchitectureContext(args: {
  harnesses: string[];
  environments: string[];
  authorization?: string;
  email?: string;
}): Promise<ArchitectureContext> {
  const warnings: string[] = [];
  const cfg = readBosConfig();
  if (!cfg.url || !cfg.anonKey) {
    warnings.push('BOS Supabase URL/key are not configured in server env');
    return makeEmptyContext(args.harnesses, args.environments, warnings);
  }

  const baseUrl = normalizeUrl(cfg.url);
  const bearer = args.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const email = args.email?.trim().toLowerCase();
  const serviceEmailMode = Boolean(email && cfg.serviceKey);
  const authToken = serviceEmailMode ? cfg.serviceKey! : bearer;
  const apiKey = serviceEmailMode ? cfg.serviceKey! : cfg.anonKey;

  if (!authToken) {
    warnings.push(email ? 'email lookup needs BOS_SUPABASE_SERVICE_ROLE_KEY' : 'send a user JWT or configure service email lookup');
    return makeEmptyContext(args.harnesses, args.environments, warnings);
  }

  const user = serviceEmailMode
    ? await resolveUserByEmail(baseUrl, cfg.serviceKey!, email!, warnings)
    : await resolveUserByJwt(baseUrl, cfg.anonKey, authToken, warnings);
  const userId = typeof user?.id === 'string' ? user.id : typeof user?.sub === 'string' ? user.sub : null;

  if (!userId) {
    return {
      ...makeEmptyContext(args.harnesses, args.environments, warnings),
      bos: {
        ...makeEmptyContext(args.harnesses, args.environments, warnings).bos,
        configured: true,
        authMode: serviceEmailMode ? 'service_email' : 'jwt',
        status: 'error',
        projectUrl: baseUrl,
        user,
      },
    };
  }

  const rows: Record<string, Record<string, unknown>[]> = {};
  rows.profiles = await restRows(baseUrl, apiKey, authToken, `profiles?select=${PROFILE_SELECT}&id=eq.${userId}&limit=1`, warnings);
  rows.organization_members = await restRows(
    baseUrl,
    apiKey,
    authToken,
    `organization_members?select=organization_id,user_id,role,created_at&user_id=eq.${userId}&limit=${REST_LIMIT}`,
    warnings
  );

  const orgIds = ids(rows.organization_members, 'organization_id');
  rows.organizations = orgIds.length
    ? await restRows(baseUrl, apiKey, authToken, `organizations?select=${ORGANIZATION_SELECT}&id=${inFilter(orgIds)}&limit=${REST_LIMIT}`, warnings)
    : [];
  rows.workspace_members = await restRows(
    baseUrl,
    apiKey,
    authToken,
    `workspace_members?select=workspace_id,user_id,role,created_at&user_id=eq.${userId}&limit=${REST_LIMIT}`,
    warnings
  );

  const workspaceIds = ids(rows.workspace_members, 'workspace_id');
  const directWorkspaces = workspaceIds.length
    ? await restRows(baseUrl, apiKey, authToken, `workspaces?select=${WORKSPACE_SELECT}&id=${inFilter(workspaceIds)}&limit=${REST_LIMIT}`, warnings)
    : [];
  const orgWorkspaces = orgIds.length
    ? await restRows(baseUrl, apiKey, authToken, `workspaces?select=${WORKSPACE_SELECT}&organization_id=${inFilter(orgIds)}&order=created_at.asc&limit=${REST_LIMIT}`, warnings)
    : [];
  rows.workspaces = Array.from(
    new Map([...directWorkspaces, ...orgWorkspaces].map((row) => [String(row.id), row])).values()
  );
  rows.user_mini_apps = await restRows(
    baseUrl,
    apiKey,
    authToken,
    `user_mini_apps?select=${APP_SELECT}&user_id=eq.${userId}&order=updated_at.desc&limit=${REST_LIMIT}`,
    warnings
  );

  const appIds = ids(rows.user_mini_apps);
  rows.project_chats = appIds.length
    ? await restRows(baseUrl, apiKey, authToken, `project_chats?select=${CHAT_SELECT}&project_id=${inFilter(appIds)}&order=updated_at.desc&limit=${REST_LIMIT}`, warnings)
    : [];
  const chatIds = ids(rows.project_chats);
  rows.chat_messages = chatIds.length
    ? await restRows(baseUrl, apiKey, authToken, `chat_messages?select=${MESSAGE_SELECT}&chat_id=${inFilter(chatIds)}&order=created_at.desc&limit=${REST_LIMIT}`, warnings)
    : [];
  rows.runs = appIds.length
    ? await restRows(baseUrl, apiKey, authToken, `runs?select=${RUN_SELECT}&project_id=${inFilter(appIds)}&order=started_at.desc&limit=${REST_LIMIT}`, warnings)
    : [];
  rows.platform_skills = await restRows(
    baseUrl,
    apiKey,
    authToken,
    'platform_skills?select=skill_key,display_name,lifecycle_state,scope_kind,scope_ref,utility&limit=30',
    warnings
  );
  rows.org_settings = orgIds.length
    ? await restRows(baseUrl, apiKey, authToken, `org_settings?select=${ORG_SETTINGS_SELECT}&org_id=${inFilter(orgIds)}&limit=${REST_LIMIT}`, warnings)
    : [];
  rows.provider_accounts = await restRows(
    baseUrl,
    apiKey,
    authToken,
    'provider_accounts?select=id,provider,status,created_at,updated_at&limit=10',
    warnings
  );

  return {
    generatedAt: new Date().toISOString(),
    runtime: runtimeContext(args.harnesses, args.environments),
    bos: {
      configured: true,
      authMode: serviceEmailMode ? 'service_email' : 'jwt',
      status: warnings.length > 0 ? 'error' : 'ready',
      projectUrl: baseUrl,
      user,
      counts: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
      rows,
      warnings,
    },
  };
}
