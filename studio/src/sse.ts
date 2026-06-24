// studio/src/sse.ts
// A minimal SSE client over fetch + ReadableStream. EventSource can't POST a
// body, and our run endpoint is POST /message, so we parse the text/event-stream
// manually. Mirrors the server's EngineEvent shape (kept in sync by hand — the
// contract is small and frozen).

export type TerminalCause = 'done' | 'error' | 'cancelled';

export type EngineEvent =
  | { type: 'stream_chunk'; text: string }
  | { type: 'tool_call'; name: string; args?: unknown; callId?: string }
  | { type: 'tool_result'; ok: boolean; output?: string; callId?: string }
  | { type: 'usage_delta'; inputTokens: number; outputTokens: number }
  | { type: 'preview_ready'; url: string; port: number }
  | { type: 'final_text'; text: string }
  | {
      type: 'log';
      category: 'kernel' | 'env' | 'harness';
      level: 'info' | 'warn' | 'error';
      message: string;
      at: number;
    }
  | { type: 'terminal'; cause: TerminalCause; error?: { code: string; message: string } };

export interface RegistryDefaults {
  harness: string;
  environment: string;
  reason: string;
  hasApiKey: boolean;
}

export interface RunRequest {
  harness: string;
  environment: string;
  prompt: string;
  sessionId: string;
}

export interface RunCallbacks {
  onEvent: (eventName: string, data: unknown) => void;
  signal?: AbortSignal;
}

// Pre-provision the session's sandbox on chat open / harness×env change, so the
// cold start is paid while the user types. Best-effort: failures are swallowed —
// the /message run path re-provisions and surfaces any real error there.
export async function warmSession(req: {
  sessionId: string;
  harness: string;
  environment: string;
}): Promise<void> {
  try {
    await fetch('/warm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    // swallow — warming is an optimization, never a hard dependency
  }
}

export async function streamRun(req: RunRequest, cb: RunCallbacks): Promise<void> {
  const res = await fetch('/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: cb.signal,
  });
  if (!res.body) throw new Error('no response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = 'message';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine += line.slice(6);
      }
      if (dataLine) {
        try {
          cb.onEvent(eventName, JSON.parse(dataLine));
        } catch {
          cb.onEvent(eventName, dataLine);
        }
      }
    }
  }
}

export async function fetchRegistry(): Promise<{
  harnesses: string[];
  environments: string[];
  defaults?: RegistryDefaults;
}> {
  const res = await fetch('/registry');
  return res.json();
}
