// src/server/wsPolyfill.ts
// supabase-js v2.10x bundles realtime-js, which constructs a RealtimeClient on
// createClient() and requires a global `WebSocket`. Native WebSocket is only
// default on Node 22+. On Node <22 (e.g. the deploy VM runs Node 20) the global
// is absent and createClient() THROWS — which made admin().auth.getUser() fail
// and every authed request return 401. Polyfilling from `ws` fixes it portably,
// independent of the host Node version. MUST be imported before any
// createClient() call (i.e. before ./supabase.js is first used).
import ws from 'ws';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = ws;
}
