import { beforeEach, describe, expect, it } from 'vitest'
import {
  EXPLORER_DEFAULT_WIDTH,
  EXPLORER_MAX_WIDTH,
  EXPLORER_MIN_WIDTH,
  clampExplorerWidth,
  useUiStore,
} from '@/state/uiStore'

// Reset the cross-cutting store to a known baseline before each test (it's a module singleton).
beforeEach(() => {
  useUiStore.setState({
    activeMode: 'explorer',
    activeOrgId: null,
    explorerOpen: true,
    explorerWidth: EXPLORER_DEFAULT_WIDTH,
    explorerView: 'nodes',
    activeNodeId: null,
    activeChatId: null,
  })
  window.localStorage.clear()
})

describe('clampExplorerWidth', () => {
  it('clamps below the minimum', () => {
    expect(clampExplorerWidth(50)).toBe(EXPLORER_MIN_WIDTH)
  })
  it('clamps above the maximum', () => {
    expect(clampExplorerWidth(9999)).toBe(EXPLORER_MAX_WIDTH)
  })
  it('rounds and passes through an in-range value', () => {
    expect(clampExplorerWidth(301.6)).toBe(302)
  })
  it('falls back to the default for a non-finite value', () => {
    expect(clampExplorerWidth(Number.NaN)).toBe(EXPLORER_DEFAULT_WIDTH)
  })
})

describe('Explorer dock state', () => {
  it('clamps + persists the width on setExplorerWidth', () => {
    useUiStore.getState().setExplorerWidth(10_000)
    expect(useUiStore.getState().explorerWidth).toBe(EXPLORER_MAX_WIDTH)
    expect(window.localStorage.getItem('island-explorer-width')).toBe(String(EXPLORER_MAX_WIDTH))
  })

  it('opens the Explorer whenever a rail mode is chosen', () => {
    useUiStore.setState({ explorerOpen: false })
    useUiStore.getState().setActiveMode('files')
    expect(useUiStore.getState().activeMode).toBe('files')
    expect(useUiStore.getState().explorerOpen).toBe(true)
  })

  it('toggles open/closed via setExplorerOpen', () => {
    useUiStore.getState().setExplorerOpen(false)
    expect(useUiStore.getState().explorerOpen).toBe(false)
  })

  it('switches the explorer view', () => {
    useUiStore.getState().setExplorerView('chats')
    expect(useUiStore.getState().explorerView).toBe('chats')
  })
})

describe('selection', () => {
  it('selecting a node resets the active chat (new node context)', () => {
    useUiStore.setState({ activeChatId: 'chat-1' })
    useUiStore.getState().selectNode('proj-9')
    expect(useUiStore.getState().activeNodeId).toBe('proj-9')
    expect(useUiStore.getState().activeChatId).toBeNull()
  })

  it('selecting a chat keeps the active node', () => {
    useUiStore.setState({ activeNodeId: 'proj-9' })
    useUiStore.getState().selectChat('chat-2')
    expect(useUiStore.getState().activeNodeId).toBe('proj-9')
    expect(useUiStore.getState().activeChatId).toBe('chat-2')
  })

  it('switching org resets node + chat selection', () => {
    useUiStore.setState({ activeNodeId: 'proj-9', activeChatId: 'chat-2' })
    useUiStore.getState().setActiveOrgId('org-5')
    expect(useUiStore.getState().activeOrgId).toBe('org-5')
    expect(useUiStore.getState().activeNodeId).toBeNull()
    expect(useUiStore.getState().activeChatId).toBeNull()
  })
})
