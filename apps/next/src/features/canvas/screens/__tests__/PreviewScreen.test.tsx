import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PreviewScreen } from '../preview/PreviewScreen'
import { useUiStore } from '@/state/uiStore'

vi.mock('@/core/preview', () => ({
  fetchPreviewMetadata: vi.fn().mockResolvedValue({
    appId: 'app-1',
    appName: 'CRM Studio',
    chatId: null,
    runnerSessionId: null,
    opencodeSessionId: null,
    status: 'no-session',
    previewUrl: null,
  }),
}))

function renderPreviewScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PreviewScreen />
    </QueryClientProvider>,
  )
}

describe('PreviewScreen', () => {
  beforeEach(() => {
    useUiStore.setState({ selectedNode: null, selectedNodeName: null })
  })

  it('asks for an app selection when no node is selected', () => {
    renderPreviewScreen()

    expect(screen.getByText('No app selected')).toBeInTheDocument()
  })

  it('renders an iframe preview for the selected app', () => {
    useUiStore.setState({
      selectedNode: { kind: 'app', id: 'app-1', name: 'CRM Studio' },
      selectedNodeName: 'CRM Studio',
    })

    renderPreviewScreen()

    expect(screen.getByText('CRM Studio')).toBeInTheDocument()
    expect(screen.getByTestId('island-preview-iframe')).toHaveAttribute(
      'title',
      'CRM Studio preview',
    )
  })
})
