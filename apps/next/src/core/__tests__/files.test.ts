import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the runner seam so we test the typed ops, not the transport.
const runnerFetch = vi.fn()
const runnerJson = vi.fn()
vi.mock('@/core/runner', () => {
  class RunnerError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  }
  return {
    runnerFetch: (...a: unknown[]) => runnerFetch(...a),
    runnerJson: (...a: unknown[]) => runnerJson(...a),
    RunnerError,
  }
})

class RunnerError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

import { readFile, writeFiles } from '@/core/files'

afterEach(() => {
  runnerFetch.mockReset()
  runnerJson.mockReset()
})

describe('readFile', () => {
  it('GETs /file with rootId+path query and returns content', async () => {
    runnerJson.mockResolvedValue({ content: 'hello' })
    const out = await readFile({ sessionId: 's1', rootId: 'app:p1', path: 'src/a.ts' })
    expect(out).toEqual({ content: 'hello' })
    const url = runnerJson.mock.calls[0][0] as string
    expect(url).toContain('/sessions/s1/file')
    expect(url).toContain('rootId=app%3Ap1')
    expect(url).toContain('path=src%2Fa.ts')
  })

  it('normalises a non-string content to empty string', async () => {
    runnerJson.mockResolvedValue({ content: null })
    expect(await readFile({ sessionId: 's1', rootId: 'app:p1', path: 'x' })).toEqual({ content: '' })
  })

  it('propagates a RunnerError on a non-2xx read', async () => {
    runnerJson.mockRejectedValue(new RunnerError('not found', 404, null))
    await expect(readFile({ sessionId: 's1', rootId: 'app:p1', path: 'x' })).rejects.toThrow('not found')
  })
})

describe('writeFiles', () => {
  it('POSTs the files payload and returns ok on 2xx', async () => {
    runnerFetch.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
    const out = await writeFiles({
      sessionId: 's1',
      files: [{ path: 'a.ts', content: 'x', rootId: 'app:p1' }],
    })
    expect(out).toEqual({ ok: true })
    const [path, init] = runnerFetch.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/sessions/s1/files')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      files: [{ path: 'a.ts', content: 'x', rootId: 'app:p1' }],
    })
  })

  it('returns the parsed error body on a non-2xx', async () => {
    runnerFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'read-only root' }),
    })
    const out = await writeFiles({ sessionId: 's1', files: [{ path: 'a', content: 'x', rootId: 'repo:r' }] })
    expect(out).toEqual({ ok: false, error: 'read-only root', status: 403 })
  })

  it('falls back to a status message when the error body is non-JSON', async () => {
    runnerFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    const out = await writeFiles({ sessionId: 's1', files: [] })
    expect(out).toMatchObject({ ok: false, status: 500 })
  })

  it('returns a structured error on a network throw', async () => {
    runnerFetch.mockRejectedValue(new Error('offline'))
    const out = await writeFiles({ sessionId: 's1', files: [] })
    expect(out).toEqual({ ok: false, error: 'offline' })
  })
})
