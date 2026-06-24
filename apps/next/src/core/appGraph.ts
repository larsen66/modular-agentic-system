import { supabase } from './supabase'
import { fetchProjectChats, type ProjectNode, type ChatNode } from './explorer'

// App-structure graph access-layer seam (canvas `graph` screen). The screen's product intent is a
// file/module dependency graph, but there is NO runner endpoint for that today — see PHASE-2 flag
// below. v1 ships the **containment graph**: a real node/link graph (app → chats → mounted apps)
// built with ZERO new backend, by reusing `core/explorer.ts` data + the `node_links(link_kind='mount')`
// edges the explorer already documents (header: `v_nodes → node_links(mount) → project_chats`).
//
// HONESTY INVARIANT (legacy/graph.md §7 trap #1): never fabricate a graph. When there is no project
// or no structure, return an empty graph (`nodes: []`) — the screen renders an honest empty/no-session
// state, NOT a decorative mock.
//
// PHASE-2 (FLAGGED — new backend capability, NOT legacy parity): the file/module dependency graph
// (imports/exports between files) requires a NEW runner route `GET /sessions/:id/structure` (file tree
// + parsed import edges) consumed here as a second `source: 'modules'|'files'`. It does not exist yet;
// `sessionId` is accepted now so the signature is stable when that lands.
//
// CORE-INTERNAL data path: membership-first RLS cascade (same as core/explorer.ts) — a DIRECT select
// on node_links returns empty under RLS unless the principal has membership on the nodes.

/** Kind of a graph node. v1 emits `app` (the project root) + `chat` + `mounted-app` (mount targets). */
export type GraphNodeKind = 'app' | 'folder' | 'chat' | 'mounted-app'

/** Semantics of an edge. v1 emits `contains` (parent→child) + `mount` (app→mounted app). */
export type GraphEdgeKind = 'contains' | 'mount' | 'imports'

/** A node in the app-structure graph (renderer-agnostic; the GraphCanvas adapter maps it). */
export interface GraphNode {
  id: string
  /** Display label. */
  label: string
  kind: GraphNodeKind
  /** Optional path/route hint (file path for module graph; null for containment nodes). */
  path: string | null
  /** Lucide-ish icon key from node metadata, or null (caller picks a default). */
  icon: string | null
  /** True for the graph's root node (the project itself) — the renderer can emphasize it. */
  isRoot?: boolean
}

/** A directed edge between two graph nodes. */
export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: GraphEdgeKind
}

/** The provenance of the graph data — drives the legend's edge-semantics copy (no overclaiming). */
export type GraphSource = 'links' | 'files' | 'modules'

/** The resolved app-structure graph. `nodes: []` is the honest empty signal (never fabricated). */
export interface AppGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  source: GraphSource
  /** ISO timestamp the graph was assembled — drives the "stale" marker if it predates the last run. */
  generatedAt: string
}

/** A row from `node_links` (mount edges). Mirror of the columns we select. */
interface MountLinkRow {
  source_node_id: string
  target_node_id: string
  metadata: { name?: string; label?: string; icon?: string } | null
}

/**
 * Build the v1 CONTAINMENT graph for a project — `app → chats` (contains) + `app → mounted-app`
 * (mount) — from existing `core/explorer.ts` data + `node_links(link_kind='mount')` edges. No new
 * backend. Returns an EMPTY graph (`nodes: []`) when `projectId` is falsy or the project has no
 * structure (honesty invariant) — the screen turns that into an empty/no-session state.
 *
 * `sessionId` is accepted for the PHASE-2 module-graph path (new runner `/structure` route) and is
 * unused in v1; passing it now keeps call sites stable across the cutover.
 */
export async function fetchAppGraph(
  projectId: string | null | undefined,
  sessionId?: string | null,
): Promise<AppGraph> {
  void sessionId // reserved for the PHASE-2 module/import graph (runner `/structure`); v1 = containment
  const generatedAt = new Date().toISOString()
  if (!projectId) {
    // Honest empty — never fabricate a graph when there's nothing to map.
    return { nodes: [], edges: [], source: 'links', generatedAt }
  }

  // 1) Chats under the project (contains edges) — reuse the explorer seam.
  const chats: ChatNode[] = await fetchProjectChats(projectId)

  // 2) Mount edges: apps mounted INTO this project (project as source_node_id, link_kind='mount').
  const mountTargets = await fetchMountTargets(projectId)

  // 3) Resolve the project's own display name (best-effort; falls back to a generic label).
  const rootLabel = await resolveProjectLabel(projectId)

  const nodes: GraphNode[] = [
    { id: projectId, label: rootLabel, kind: 'app', path: null, icon: null, isRoot: true },
  ]
  const edges: GraphEdge[] = []

  for (const chat of chats) {
    nodes.push({ id: chat.id, label: chat.name, kind: 'chat', path: null, icon: null })
    edges.push({ id: `contains:${projectId}:${chat.id}`, source: projectId, target: chat.id, kind: 'contains' })
  }

  for (const m of mountTargets) {
    nodes.push({
      id: m.target_node_id,
      label: m.metadata?.label ?? m.metadata?.name ?? 'Mounted app',
      kind: 'mounted-app',
      path: null,
      icon: m.metadata?.icon ?? null,
    })
    edges.push({
      id: `mount:${projectId}:${m.target_node_id}`,
      source: projectId,
      target: m.target_node_id,
      kind: 'mount',
    })
  }

  return { nodes, edges, source: 'links', generatedAt }
}

/**
 * Apps mounted into a project via `node_links(link_kind='mount')` where the project is the source.
 * Returns `[]` on any RLS/empty result (caller treats it as "no mounts", not an error).
 */
async function fetchMountTargets(projectId: string): Promise<MountLinkRow[]> {
  const { data, error } = await supabase
    .from('node_links')
    .select('source_node_id, target_node_id, metadata')
    .eq('source_node_id', projectId)
    .eq('link_kind', 'mount')
  if (error) throw new Error(`fetchAppGraph mount-links failed: ${error.message}`)
  return (data ?? []) as MountLinkRow[]
}

/**
 * Best-effort display name for the project root. Looks it up in `v_nodes` by source_id; on miss
 * (RLS / not found) returns a generic label rather than throwing — the graph is still honest.
 */
async function resolveProjectLabel(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('v_nodes')
    .select('name')
    .eq('source_id', projectId)
    .limit(1)
  if (error || !data || data.length === 0) return 'This app'
  return ((data[0] as { name?: string }).name as string) || 'This app'
}

// Re-export the explorer types we lean on so a graph consumer needn't reach across seams.
export type { ProjectNode, ChatNode }
