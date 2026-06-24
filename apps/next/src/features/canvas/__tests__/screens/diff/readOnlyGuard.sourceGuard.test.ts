import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read-only invariant (design §5 row 4, §7 test "Read-only guarantee"): the diff screen SHOWS a run's
// changes, it never mutates. Governed apply/accept/reject/rollback is OPS-domain. This source guard
// fails if any accept/reject/apply/rollback affordance leaks into the diff feature surface.

const DIRS = [
  'src/features/canvas/screens/diff',
  'src/features/canvas/components/diff',
]
const FORBIDDEN = /\b(onAccept|onReject|onApply|onRollback|acceptHunk|rejectHunk|applyDiff|rollbackRun)\b/

function collect(dir: string): string[] {
  const root = join(process.cwd(), dir)
  const out: string[] = []
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && /\.tsx?$/.test(e.name)) out.push(join(root, e.name))
  }
  return out
}

describe('diff screen is read-only', () => {
  it('contains no accept/reject/apply/rollback affordance', () => {
    for (const dir of DIRS) {
      for (const f of collect(dir)) {
        const src = readFileSync(f, 'utf8')
        expect(FORBIDDEN.test(src), `${f} must not contain a write/apply affordance`).toBe(false)
      }
    }
  })
})
