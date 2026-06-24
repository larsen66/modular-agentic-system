// src/harnesses/cli/detect.ts
// Presence-only auth detection. Used by the claude-agent-sdk harness to tell
// whether the user has an existing local `claude` login (a Claude subscription),
// WITHOUT any API key and WITHOUT ever touching a credential value.
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
