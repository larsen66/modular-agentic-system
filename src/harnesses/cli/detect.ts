// src/harnesses/cli/detect.ts
// Presence-only auth detection for the CLI-credential harnesses. The whole point
// of these harnesses is to reuse the user's EXISTING local `hermes`, `claude`,
// or `codex`
// logins WITHOUT any API key and WITHOUT ever touching a credential value.
//
// SECURITY (hard rule): we NEVER read, print, log, or return any token / auth
// file content. We check only PRESENCE — does the binary exist, and does an auth
// file / status indicate a login. The detected booleans are the only output.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliStatus {
  installed: boolean; // binary resolvable on PATH
  loggedIn: boolean; // a login is present (file present / status reports logged-in)
}

function which(bin: string): boolean {
  const r = spawnSync('/bin/sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

// Claude Code: login lives in the macOS Keychain OR ~/.claude/.credentials.json.
// `claude auth status` prints a JSON object whose `loggedIn` field is the truth.
// We parse ONLY the `loggedIn` boolean — never the email/org/key fields.
export function detectClaude(): CliStatus {
  const installed = which('claude');
  if (!installed) return { installed: false, loggedIn: false };
  let loggedIn = false;
  try {
    const r = spawnSync('claude', ['auth', 'status'], { encoding: 'utf8', timeout: 8000 });
    if (r.status === 0 && r.stdout) {
      // Match the boolean field only; do not capture or retain anything else.
      loggedIn = /"loggedIn"\s*:\s*true/.test(r.stdout);
    }
  } catch {
    /* fall through to presence heuristic */
  }
  // Fallback: a credentials file present is a reasonable presence signal even if
  // the status call is unavailable. (Keychain logins won't have this file; the
  // status call above covers those.)
  if (!loggedIn && existsSync(join(homedir(), '.claude', '.credentials.json'))) {
    loggedIn = true;
  }
  return { installed, loggedIn };
}

// Codex: login lives in ~/.codex/auth.json (ChatGPT OAuth tokens OR a stored
// key). We check ONLY that the file exists — we never open or parse its contents.
export function detectCodex(): CliStatus {
  const installed = which('codex');
  if (!installed) return { installed: false, loggedIn: false };
  const loggedIn = existsSync(join(homedir(), '.codex', 'auth.json'));
  return { installed, loggedIn };
}

// Hermes Agent: auth and user-managed secrets live under HERMES_HOME (default
// ~/.hermes). Prefer the CLI's own status probe when available; fall back to
// presence-only checks for auth/config files. We never read file contents.
export function detectHermes(): CliStatus {
  const installed = which('hermes');
  if (!installed) return { installed: false, loggedIn: false };
  const hermesHome = process.env.HERMES_HOME?.trim() || join(homedir(), '.hermes');
  let loggedIn = false;
  try {
    const r = spawnSync('hermes', ['auth', 'status'], { encoding: 'utf8', timeout: 8000 });
    if (r.status === 0) {
      const out = `${r.stdout}\n${r.stderr}`.toLowerCase();
      loggedIn = /\b(logged in|authenticated|configured|available|active|ok)\b/.test(out);
    }
  } catch {
    /* fall through to presence heuristic */
  }
  if (
    !loggedIn &&
    (existsSync(join(hermesHome, 'auth.json')) || existsSync(join(hermesHome, '.env')))
  ) {
    loggedIn = true;
  }
  return { installed, loggedIn };
}

// A harness is "ready" when its CLI is installed AND a login is present. This is
// what makes a CLI harness the zero-key default.
export function claudeCliReady(): boolean {
  const s = detectClaude();
  return s.installed && s.loggedIn;
}

export function codexCliReady(): boolean {
  const s = detectCodex();
  return s.installed && s.loggedIn;
}

export function hermesCliReady(): boolean {
  const s = detectHermes();
  return s.installed && s.loggedIn;
}
