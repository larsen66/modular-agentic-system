import { afterEach, describe, expect, it, vi } from 'vitest'

// The runs seam reuses `core/runner.ts` (which needs the Supabase JWT). Mock the auth session + a
// fixed runner base URL, then assert the request shape and the RunDiff normalization.
vi.mock('@/core/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'jwt-123' } } }),
      refreshSession: async () => ({}),
    },
  },
}))

import { RUNNER_URL } from '@/core/runner'
import { getRunDiff } from '@/core/runs'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => fetchMock.mockReset())

describe('getRunDiff', () => {
  it('GETs /runs/:runId/diff with Bearer + Accept json', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { runId: 'r1', files: [] }))
    await getRunDiff('r 1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${RUNNER_URL}/runs/r%201/diff`)
    expect(init.method ?? 'GET').toBe('GET')
    expect(init.headers.get('Authorization')).toBe('Bearer jwt-123')
    expect(init.headers.get('Accept')).toBe('application/json')
  })

  it('normalizes a modified file (counts + old/new content)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        runId: 'r1',
        files: [
          { path: 'src/App.tsx', status: 'modified', additions: 12, deletions: 3, oldContents: 'a', newContents: 'b' },
        ],
      }),
    )
    const res = await getRunDiff('r1')
    expect(res).toEqual({
      runId: 'r1',
      files: [
        { path: 'src/App.tsx', prevPath: undefined, status: 'modified', additions: 12, deletions: 3, oldContents: 'a', newContents: 'b' },
      ],
    })
  })

  it('coerces added (oldContents="") and deleted (newContents="") when a side is omitted', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        files: [
          { path: 'new.ts', status: 'added', additions: 40, deletions: 0, newContents: 'x' },
          { path: 'old.ts', status: 'deleted', additions: 0, deletions: 58, oldContents: 'y' },
        ],
      }),
    )
    const res = await getRunDiff('r1')
    expect(res.runId).toBe('r1') // falls back to the arg when body omits runId
    expect(res.files[0]).toMatchObject({ status: 'added', oldContents: '', newContents: 'x' })
    expect(res.files[1]).toMatchObject({ status: 'deleted', oldContents: 'y', newContents: '' })
  })

  it('keeps null content as content-unavailable (no coercion for modified)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { files: [{ path: 'img.png', status: 'modified', additions: 0, deletions: 0, oldContents: null, newContents: null }] }),
    )
    const res = await getRunDiff('r1')
    expect(res.files[0].oldContents).toBeNull()
    expect(res.files[0].newContents).toBeNull()
  })

  it('carries prevPath only for renamed files', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        files: [
          { path: 'b.ts', oldPath: 'a.ts', status: 'renamed', additions: 1, deletions: 1, oldContents: 'a', newContents: 'b' },
        ],
      }),
    )
    const res = await getRunDiff('r1')
    expect(res.files[0]).toMatchObject({ status: 'renamed', path: 'b.ts', prevPath: 'a.ts' })
  })

  it('accepts the legacy `diff` + `file` aliases and git-letter statuses', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { diff: [{ file: 'x.ts', status: 'A', additions: 2, deletions: 0, newContents: 'z' }] }),
    )
    const res = await getRunDiff('r1')
    expect(res.files[0]).toMatchObject({ path: 'x.ts', status: 'added', additions: 2, oldContents: '' })
  })

  it('treats an empty files array as a valid no-changes result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { runId: 'r1', files: [] }))
    const res = await getRunDiff('r1')
    expect(res.files).toEqual([])
  })

  it('throws RunnerError on non-2xx', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'run not found' }))
    await expect(getRunDiff('nope')).rejects.toMatchObject({ name: 'RunnerError', status: 404 })
  })
})
