import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PreviewIframeHost } from '@/shared/PreviewIframeHost'

describe('PreviewIframeHost', () => {
  it('renders nothing when url is null', () => {
    render(<PreviewIframeHost url={null} title="Preview" />)
    expect(screen.queryByTestId('canvas-preview-iframe')).not.toBeInTheDocument()
  })

  it('snaps directly to the first url (no candidate)', () => {
    render(<PreviewIframeHost url="https://x/app" title="Preview" />)
    const active = screen.getByTestId('canvas-preview-iframe') as HTMLIFrameElement
    expect(active.src).toContain('https://x/app')
    expect(screen.queryByTestId('canvas-preview-candidate')).not.toBeInTheDocument()
  })

  it('registers and unregisters the active iframe ref', () => {
    const onRegisterIframe = vi.fn()
    const { unmount } = render(
      <PreviewIframeHost url="https://x/app" title="Preview" onRegisterIframe={onRegisterIframe} />,
    )
    expect(onRegisterIframe).toHaveBeenCalledWith(expect.any(HTMLIFrameElement))
    onRegisterIframe.mockClear()
    unmount()
    expect(onRegisterIframe).toHaveBeenCalledWith(null)
  })

  it('warms a hidden candidate on a same-surface url change, then handoff fires', async () => {
    const onHandoffChange = vi.fn()
    const { rerender } = render(
      <PreviewIframeHost url="https://x/app?v=1" title="Preview" onHandoffChange={onHandoffChange} />,
    )
    rerender(
      <PreviewIframeHost url="https://x/app?v=2" title="Preview" onHandoffChange={onHandoffChange} />,
    )
    await waitFor(() => expect(screen.getByTestId('canvas-preview-candidate')).toBeInTheDocument())
    expect(onHandoffChange).toHaveBeenCalledWith(true)
  })

  it('snaps directly (no candidate) when the mounted surface changes', () => {
    const { rerender } = render(
      <PreviewIframeHost url="https://x/app?v=1" hostWorkspaceId="ws1" title="Preview" />,
    )
    rerender(<PreviewIframeHost url="https://x/app?v=2" hostWorkspaceId="ws2" title="Preview" />)
    const active = screen.getByTestId('canvas-preview-iframe') as HTMLIFrameElement
    expect(active.src).toContain('v=2')
    expect(screen.queryByTestId('canvas-preview-candidate')).not.toBeInTheDocument()
  })
})
