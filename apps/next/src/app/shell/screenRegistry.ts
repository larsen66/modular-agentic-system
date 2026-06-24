/**
 * Screen registry — content-agnostic host map for Stage panes.
 *
 * Per AREA.md §5 "Content-agnostic layout engine": the Stage manages geometry only; a Pane is a
 * dumb host given `{screenId, props}` and renders via this registry. Hosted screens know nothing
 * about panes, dragging, or neighbours. This module is the registry half of that contract.
 *
 * Rules:
 *  - No React context, no shell imports, no side effects at module load time.
 *  - Screens are keyed by an opaque string id — the caller assigns meaning.
 *  - Registration is idempotent: re-registering the same id overwrites silently.
 */

import type { ComponentType } from 'react'

/** Opaque identifier for a registered screen (any non-empty string). */
export type ScreenId = string

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>

// Module-level registry — plain Map, no React context required.
const registry = new Map<ScreenId, AnyComponent>()

/**
 * Register a screen component under the given id.
 * Idempotent: a second call for the same id overwrites the previous entry.
 *
 * @param id       - Stable string key the Pane will reference (e.g. `'chat'`, `'preview'`).
 * @param component - The React component to render; receives arbitrary props forwarded by the Pane.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerScreen(id: ScreenId, component: ComponentType<any>): void {
  registry.set(id, component)
}

/**
 * Look up a screen by id.
 *
 * @returns The registered component, or `undefined` if the id has not been registered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getScreen(id: ScreenId): ComponentType<any> | undefined {
  return registry.get(id)
}

/**
 * Return a snapshot of all currently registered screen ids.
 * Order reflects insertion order (Map iteration contract).
 */
export function listScreens(): ScreenId[] {
  return Array.from(registry.keys())
}
