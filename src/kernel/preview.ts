// src/kernel/preview.ts
// Preview STATE (the routing/session map), single-writer. Core keeps preview
// state; the ENV resolves the URL. The kernel only ever stores/forwards a URL
// string — it never knows about hostPort, DNS, TLS, or any proxy mechanism.

export interface PreviewState {
  url: string;
  port: number;
}

export class PreviewRegistry {
  private bySession = new Map<string, PreviewState>();

  set(sessionId: string, state: PreviewState): void {
    this.bySession.set(sessionId, state);
  }

  get(sessionId: string): PreviewState | undefined {
    return this.bySession.get(sessionId);
  }

  clear(sessionId: string): void {
    this.bySession.delete(sessionId);
  }
}
