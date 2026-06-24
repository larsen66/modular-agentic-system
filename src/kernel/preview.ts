// src/kernel/preview.ts
// Preview STATE (the routing/session map), single-writer. Core keeps preview
// state; the ENV resolves the URL. The kernel only ever stores/forwards a URL
// string — it never knows about hostPort, DNS, TLS, or any proxy mechanism.

export interface PreviewState {
  // Live proxy URL — ephemeral, dies with the sandbox. May be '' when only a
  // durable snapshot exists (the sandbox already went away).
  url: string;
  port: number;
  // Durable static snapshot id (content hash) if one was captured for this
  // session. The kernel serves it from the preview-snapshot store regardless of
  // whether the live sandbox is still up.
  snapshotId?: string;
}

export class PreviewRegistry {
  private bySession = new Map<string, PreviewState>();

  set(sessionId: string, state: PreviewState): void {
    // Preserve any durable snapshot already recorded for the session: a later
    // live `preview_ready` (e.g. a re-run) must not erase the snapshot pointer.
    const prev = this.bySession.get(sessionId);
    this.bySession.set(sessionId, { ...state, snapshotId: state.snapshotId ?? prev?.snapshotId });
  }

  // Record the durable snapshot pointer without disturbing the live url/port.
  // Single-writer: only the orchestrator pump calls this (on preview_snapshot_ready).
  setSnapshot(sessionId: string, snapshotId: string): void {
    const prev = this.bySession.get(sessionId);
    this.bySession.set(sessionId, { url: prev?.url ?? '', port: prev?.port ?? 0, snapshotId });
  }

  get(sessionId: string): PreviewState | undefined {
    return this.bySession.get(sessionId);
  }

  clear(sessionId: string): void {
    this.bySession.delete(sessionId);
  }
}
