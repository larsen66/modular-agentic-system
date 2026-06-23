// src/server/sse.ts
// EngineEvent → SSE serialization. One line of policy: each event becomes an
// `event: <type>\ndata: <json>\n\n` frame. Nothing substrate-aware here.

import type { EngineEvent } from '../types/index.js';

export function serializeEvent(ev: EngineEvent): string {
  return `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
}
