import { describe, expect, it } from 'vitest'
import { buildPreviewUrl, cachedViewerPreflightUrl } from '@/features/canvas/lib/previewUrl'

// RUNNER_URL resolves to the same-origin local proxy base in jsdom (hostname=localhost), so
// buildPreviewUrl returns a relative path+query — assert on path + params, not an absolute origin.

describe('buildPreviewUrl', () => {
  it('returns null without a path or token', () => {
    expect(buildPreviewUrl({ previewPath: null, previewToken: 't' })).toBeNull()
    expect(buildPreviewUrl({ previewPath: '/sessions/s1/preview', previewToken: null })).toBeNull()
  })

  it('builds the dev/legacy path with token + cache-busters', () => {
    const url = buildPreviewUrl({
      previewPath: '/sessions/s1/preview',
      previewToken: 'tok',
      builtAt: 123,
      devRunNonce: 7,
      selectedSurface: 'built',
      hostWorkspaceId: 'ws1',
    })
    expect(url).toContain('/sessions/s1/preview')
    expect(url).toContain('previewToken=tok')
    expect(url).toContain('_v=123')
    expect(url).toContain('_r=7')
    expect(url).toContain('hostWorkspaceId=ws1')
  })

  it('OMITS _v on the dev surface (HMR owns reloads → no white blink)', () => {
    const url = buildPreviewUrl({
      previewPath: '/sessions/s1/preview',
      previewToken: 'tok',
      builtAt: 123,
      selectedSurface: 'dev',
    })
    expect(url).not.toContain('_v=')
  })

  it('uses the immutable cached-viewer path when gated + preflighted', () => {
    const url = buildPreviewUrl({
      previewPath: '/sessions/s1/preview',
      previewToken: 'tok',
      builtAt: 99,
      buildHash: 'abc123',
      selectedSurface: 'built',
      useCachedViewer: true,
    })
    expect(url).toContain('/sessions/s1/preview-cache/abc123/index.html')
    expect(url).toContain('previewToken=tok')
    expect(url).toContain('_v=99')
  })

  it('ignores cached-viewer when buildHash is missing', () => {
    const url = buildPreviewUrl({
      previewPath: '/sessions/s1/preview',
      previewToken: 'tok',
      useCachedViewer: true,
      buildHash: null,
    })
    expect(url).toContain('/sessions/s1/preview?')
    expect(url).not.toContain('preview-cache')
  })
})

describe('cachedViewerPreflightUrl', () => {
  it('points at the immutable index for the build hash', () => {
    expect(cachedViewerPreflightUrl('/sessions/s1/preview', 'h9')).toContain('/sessions/s1/preview-cache/h9/index.html')
  })
})
