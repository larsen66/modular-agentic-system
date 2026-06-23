import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..', '..', '..');

export const DEFAULT_ENV_FILES = [
  path.join(REPO_ROOT, '.harness.env'),
  path.join(REPO_ROOT, '.env'),
  path.join(ROOT, '.harness.env'),
  path.join(ROOT, '.env'),
  path.join(process.cwd(), '.harness.env'),
  path.join(process.cwd(), '.env'),
];

const FRIENDLY_KEY_MAP: Record<string, string> = {
  E2B: 'E2B_API_KEY',
  Daytona: 'DAYTONA_API_KEY',
  Vercel: 'VERCEL_TOKEN',
};

export function parseEnvContent(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!key) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadHarnessEnv(paths = DEFAULT_ENV_FILES): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const filePath of paths) {
    const abs = path.resolve(filePath);
    if (seen.has(abs) || !fs.existsSync(abs)) continue;
    seen.add(abs);
    Object.assign(out, parseEnvContent(fs.readFileSync(abs, 'utf8')));
  }
  return out;
}

export function applyHarnessEnv(paths?: string[]): void {
  const env = loadHarnessEnv(paths);

  for (const [source, target] of Object.entries(FRIENDLY_KEY_MAP)) {
    if (env[source] && !process.env[target]) process.env[target] = env[source];
  }
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const openRouter = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || env.OPENROUTER;
  if (openRouter) {
    process.env.OPENROUTER_API_KEY = openRouter;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || openRouter;
    process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    process.env.SDK_MODEL = process.env.SDK_MODEL || 'openai/gpt-4o-mini';
    process.env.OPENAI_AGENTS_MODEL = process.env.OPENAI_AGENTS_MODEL || 'openai/gpt-4o-mini';
  }
}
