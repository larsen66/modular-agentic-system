#!/usr/bin/env node
// The grep acceptance test (the headline gate). The kernel + registry +
// contracts must have ZERO substrate words. Substrate types are allowed ONLY
// inside src/environments/<adapter>/. If dockerode / container_id / getHost
// appears in src/kernel, src/registry, or src/types, the seam is breached.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Words that must never appear in the protected dirs.
const FORBIDDEN = [
  'container_id',
  'dockerode',
  'workspace_dir',
  '@vercel',
  'getPreviewLink',
  'getHost',
  'hostPort',
  'put_archive',
  'get_archive',
];
// `\be2b\b` handled separately as a word-boundary regex.
const E2B = /\be2b\b/i;

const PROTECTED_DIRS = ['src/kernel', 'src/registry', 'src/types'];

// Remove // line comments and /* */ block comments (tracking block state across
// lines) so only executable code is scanned. Not a full TS parser — adequate
// for the gate, and conservative: it only ever ignores comment text.
function stripComment(line, getBlock, setBlock) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (getBlock()) {
      const end = line.indexOf('*/', i);
      if (end === -1) return out; // rest of line is inside the block comment
      setBlock(false);
      i = end + 2;
      continue;
    }
    if (line[i] === '/' && line[i + 1] === '/') return out; // line comment
    if (line[i] === '/' && line[i + 1] === '*') {
      setBlock(true);
      i += 2;
      continue;
    }
    out += line[i];
    i += 1;
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

let leaks = [];
for (const rel of PROTECTED_DIRS) {
  const dir = join(ROOT, rel);
  let files;
  try {
    files = walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let inBlockComment = false;
    lines.forEach((line, i) => {
      // Strip comments so explanatory prose (e.g. "no container_id here") never
      // trips the gate — only substrate identity in actual CODE is a leak.
      const code = stripComment(line, () => inBlockComment, (v) => (inBlockComment = v));
      if (!code.trim()) return;

      for (const word of FORBIDDEN) {
        if (code.includes(word)) {
          leaks.push(`${file}:${i + 1}  →  ${word}   ${line.trim()}`);
        }
      }
      if (E2B.test(code)) {
        leaks.push(`${file}:${i + 1}  →  e2b   ${line.trim()}`);
      }
    });
  }
}

if (leaks.length > 0) {
  console.error('LEAK ❌ — substrate identity reached the kernel/contracts:\n');
  for (const l of leaks) console.error('  ' + l);
  process.exit(1);
} else {
  console.log('clean ✅  — src/kernel, src/registry, src/types contain zero substrate words');
  process.exit(0);
}
