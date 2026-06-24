#!/usr/bin/env node
// Island module-boundary guard (Constitution v1.3.0 Principle IV + X).
//
// Enforces the structural contract in docs/design/ARCHITECTURE.md §3 + §5. Files placed in the
// wrong layer (a test outside __tests__/, a prop contract outside types.ts, a test that reaches
// source via a fragile relative climb) silently erode the scaffold; review alone kept missing
// them, so they are now mechanical failures.
//
// Rule 1 — the seam is REAL: the raw Supabase client may be imported ONLY inside src/core/**.
//   This catches both forms, by RESOLVING paths (not string-matching), so it cannot be
//   laundered through the seam's own re-export:
//     - the legacy client:  @core/integrations/supabase/client
//     - the island seam:    src/core/supabase  (reached via @/core/supabase or any ../core/supabase)
//   Any file outside src/core/** that imports either = violation. Features/shared/app/pages must
//   consume TYPED operations from core/* (e.g. core/session), never the client itself.
//
// Rule 2 — no cross-feature imports: a file under src/features/<A>/** may not import from a
//   different feature module src/features/<B>/**.
//
// Rule 3 — tests live ONLY in __tests__/ (ARCHITECTURE §3 "Tests"): every *.test.* / *.spec.*
//   file must sit under a `__tests__/` segment (mirroring its source path inside the feature, or
//   src/core/__tests__/ · src/state/__tests__/ for non-feature layers). Co-located tests next to
//   source are forbidden. `src/test/` is GLOBAL HELPERS only — no test files live there.
//
// Rule 4 — component prop contracts live in the module's types surface (ARCHITECTURE §3 "types.ts
//   is the module's single types surface … Components import their Props from ../../types, not
//   inline"). Inside src/features/<A>/**, no file other than `types.ts` (or a `types/` folder) may
//   `export` a `*Props` interface/type. (Purely file-local, NON-exported inline props are tolerated;
//   placement of non-Props domain types beyond this is a review backstop.)
//
// Rule 5 — tests import via the `@/` alias, not parent-relative climbs (ARCHITECTURE §3 + island
//   alias convention): a file under `__tests__/` may not import with a `../` specifier. Same-dir
//   `./` fixtures and `@/` aliases are fine. This keeps tests location-independent (a moved test
//   should not break) and matches how source-under-test is referenced everywhere else.
//
// Run: node scripts/check-island-boundaries.mjs   (npm: npm run lint:boundaries)
//
// Residual (accepted): re-exporting the client from a NEW core barrel and importing that barrel
// would not be caught — keep the client confined to core/supabase.ts and don't add such a barrel.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')
const CLIENT_MODULE = join(SRC, 'core', 'supabase') // the island's sole client holder
const LEGACY_CLIENT_RE = /^@core\/integrations\/supabase\/client(\/|$)/

const TEST_FILE_RE = /\.(test|spec)\.(tsx?|jsx?|mjs)$/
// `export interface FooProps {` / `export type Props = …` — public component prop contracts.
const EXPORTED_PROPS_RE = /^export\s+(?:interface|type)\s+(\w*Props)\b/gm

/** Recursively collect .ts/.tsx files under a dir. */
function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/** Resolve a local import specifier to an absolute, extension-stripped path, or null if external. */
function resolveLocal(spec, fromFile) {
  let abs
  if (spec.startsWith('@/')) abs = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) abs = resolve(dirname(fromFile), spec)
  else return null // npm package or @core/* legacy (handled separately)
  return abs.replace(/\.(tsx?|jsx?|mjs)$/, '').replace(/[/\\]index$/, '')
}

/** The feature module a path belongs to (segment after src/features/), or null. */
function featureOf(absPathNoExt) {
  const featuresRoot = join(SRC, 'features') + '/'
  const norm = absPathNoExt.replace(/\\/g, '/')
  if (!norm.startsWith(featuresRoot.replace(/\\/g, '/'))) return null
  return norm.slice(featuresRoot.length).split('/')[0] || null
}

const violations = []

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, '/')
  const segs = rel.split('/')
  const inCore = rel.startsWith('core/')
  const inFeatures = rel.startsWith('features/')
  const owner = featureOf(file.replace(/\.(tsx?|jsx?|mjs)$/, '')) // this file's feature, if any
  const isTest = TEST_FILE_RE.test(rel)
  const inTestsDir = segs.includes('__tests__')
  const isTypesSurface = segs[segs.length - 1] === 'types.ts' || segs.includes('types')

  const src = readFileSync(file, 'utf8')

  // Rule 3: a test file must live under a __tests__/ directory.
  if (isTest && !inTestsDir) {
    violations.push({
      file: rel,
      rule: 'tests-only-in-__tests__ (move into the feature/layer __tests__/, mirroring the source path)',
    })
  }

  // Rule 4: exported `*Props` belong in the module's types surface, not a component/screen/etc.
  if (inFeatures && !isTypesSurface && !isTest) {
    let pm
    EXPORTED_PROPS_RE.lastIndex = 0
    while ((pm = EXPORTED_PROPS_RE.exec(src))) {
      violations.push({
        file: rel,
        rule: `props-belong-in-types.ts (move "export ${pm[1]}" into features/${owner}/types.ts and import it)`,
      })
    }
  }

  let m
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] ?? m[2]
    if (!spec) continue

    const localTarget = resolveLocal(spec, file)
    const isClient = LEGACY_CLIENT_RE.test(spec) || localTarget === CLIENT_MODULE

    // Rule 1: the raw client is core-internal.
    if (isClient && !inCore) {
      violations.push({
        file: rel,
        spec,
        rule: 'client-is-core-internal (import a typed op from core/*, never the supabase client)',
      })
    }

    // Rule 2: no cross-feature imports.
    if (owner && localTarget) {
      const target = featureOf(localTarget)
      if (target && target !== owner) {
        violations.push({
          file: rel,
          spec,
          rule: `no-cross-feature-import (features/${owner} → features/${target})`,
        })
      }
    }

    // Rule 5: tests reference source via the `@/` alias, never a `../` relative climb.
    if (isTest && spec.startsWith('../')) {
      violations.push({
        file: rel,
        spec,
        rule: 'tests-use-@/-alias-not-relative-climb (rewrite "../…" as "@/…" so the test is move-safe)',
      })
    }
  }
}

if (violations.length) {
  console.error(`\n✗ Island boundary guard: ${violations.length} violation(s)\n`)
  for (const v of violations) {
    const detail = v.spec ? `\n    imports "${v.spec}"` : ''
    console.error(`  ${v.file}${detail}\n    → ${v.rule}\n`)
  }
  process.exit(1)
}

console.log('✓ Island boundary guard: no violations')
