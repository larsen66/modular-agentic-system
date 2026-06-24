import type { User } from '@supabase/supabase-js'
import type { Organization } from '@/core/orgs'
import type { Workspace } from '@/core/workspaces'

// Typed fixture builders for the shell's domain types. Mocks are allowed in tests (Constitution
// Principle VIII bars them only from product code). Each factory returns a sensible default and
// accepts a partial override so a test states only the field it cares about.

let userSeq = 0
let orgSeq = 0
let wsSeq = 0

export function makeUser(overrides: Partial<User> = {}): User {
  userSeq += 1
  return {
    id: `user-${userSeq}`,
    app_metadata: {},
    user_metadata: { full_name: 'Ada Lovelace' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email: 'ada@example.com',
    ...overrides,
  } as User
}

export function makeOrg(overrides: Partial<Organization> = {}): Organization {
  orgSeq += 1
  return {
    id: `org-${orgSeq}`,
    name: `Org ${orgSeq}`,
    slug: `org-${orgSeq}`,
    role: 'owner',
    ...overrides,
  }
}

export function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  wsSeq += 1
  return {
    id: `ws-${wsSeq}`,
    name: `Workspace ${wsSeq}`,
    slug: `ws-${wsSeq}`,
    organizationId: null,
    ...overrides,
  }
}
