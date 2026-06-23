// src/server/auth.ts
// Request authentication, lifted from prod's pattern
// (runner-service/src/auth.ts + supabaseAdmin.ts::requireUserFromJwt).
//
//   Authorization: Bearer <jwt>  →  validated via admin.auth.getUser(jwt)  →  ownerId
//
// A 5-minute cache + inflight dedup mirrors prod getUserFromJwtCached so a burst
// of requests on one token shares a single GoTrue lookup.
//
// DEV ESCAPE HATCH: with DEV_NO_AUTH=1, requests with no token resolve to
// DEV_OWNER_ID (default = the seeded Alice). This keeps the curl examples alive
// for WRITE paths (runs are written by service_role; identity only needs to be
// stamped into admission.principal). RLS-gated READ paths still require a real
// JWT — there is no way to forge one GoTrue will accept, by design.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { admin } from './supabase.js';

const DEV_ALICE = '11111111-1111-1111-1111-111111111111';

export function getBearerToken(headerValue: string | undefined | null): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

interface CacheEntry {
  ownerId: string;
  expiresAt: number;
}
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

async function resolveOwnerId(jwt: string): Promise<string> {
  const hit = cache.get(jwt);
  if (hit && hit.expiresAt > Date.now()) return hit.ownerId;

  const existing = inflight.get(jwt);
  if (existing) return existing;

  const p = (async () => {
    const { data, error } = await admin().auth.getUser(jwt);
    if (error || !data.user) throw new Error('Unauthorized');
    cache.set(jwt, { ownerId: data.user.id, expiresAt: Date.now() + TTL_MS });
    return data.user.id;
  })().finally(() => inflight.delete(jwt));

  inflight.set(jwt, p);
  return p;
}

// What the preHandler attaches to the request. ownerId is always present after
// a successful auth; userJwt is null only on the DEV_NO_AUTH no-token path.
export interface AuthContext {
  ownerId: string;
  userJwt: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

// Fastify preHandler. Resolves ownerId from the Bearer token (or DEV fallback)
// and rejects with 401 when neither is available.
export async function authPreHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const jwt = getBearerToken(req.headers.authorization);

  if (!jwt) {
    if (process.env.DEV_NO_AUTH === '1') {
      req.auth = { ownerId: process.env.DEV_OWNER_ID || DEV_ALICE, userJwt: null };
      return;
    }
    reply.code(401).send({ error: 'missing bearer token' });
    return;
  }

  try {
    const ownerId = await resolveOwnerId(jwt);
    req.auth = { ownerId, userJwt: jwt };
  } catch {
    reply.code(401).send({ error: 'invalid or expired token' });
  }
}
