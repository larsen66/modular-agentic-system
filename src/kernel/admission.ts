// src/kernel/admission.ts
// Policy: one POST = one intent. Reject if a run is already active for the
// session (writer-lock). Substrate-independent — the answer does NOT differ
// between Docker and Daytona.

export interface AdmissionDecision {
  ok: boolean;
  code?: 'run_already_active' | 'not_ready';
  retryAfterMs?: number;
}

export class Admission {
  private active = new Set<string>();

  admit(sessionId: string): AdmissionDecision {
    if (this.active.has(sessionId)) {
      return { ok: false, code: 'run_already_active', retryAfterMs: 500 };
    }
    this.active.add(sessionId);
    return { ok: true };
  }

  release(sessionId: string): void {
    this.active.delete(sessionId);
  }
}
