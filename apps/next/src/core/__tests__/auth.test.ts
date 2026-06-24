import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// core/auth behavior against a mocked Supabase seam (the @/core/supabase module is the single seam;
// mocking it is the established island test pattern — see history.test.ts). We assert the real
// branching logic: email normalization, verified detection, duplicate-account detection on signup,
// the verification-email trigger, and the invite RPC mapping.
// vi.hoisted so the mocks exist when the hoisted vi.mock factory runs.
const { auth, functionsInvoke, rpc } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
  },
  functionsInvoke: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    auth,
    functions: { invoke: (...a: unknown[]) => functionsInvoke(...a) },
    rpc: (...a: unknown[]) => rpc(...a),
    from: vi.fn(),
  },
}))

import {
  normalizeEmail,
  isEmailVerified,
  signUpWithPassword,
  getWorkspaceInvitationSummary,
  acceptWorkspaceInvitation,
} from '../auth'

beforeEach(() => {
  functionsInvoke.mockResolvedValue({ data: {}, error: null })
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jane.Doe@Company.COM ')).toBe('jane.doe@company.com')
  })
})

describe('isEmailVerified', () => {
  it('is false for null user', () => {
    expect(isEmailVerified(null)).toBe(false)
  })
  it('is true when email_confirmed_at is set', () => {
    expect(isEmailVerified({ email_confirmed_at: '2026-01-01T00:00:00Z' } as never)).toBe(true)
  })
  it('is false when unconfirmed', () => {
    expect(isEmailVerified({ email_confirmed_at: null } as never)).toBe(false)
  })
})

describe('signUpWithPassword', () => {
  it('returns userId and triggers the verification email on success', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] } },
      error: null,
    })
    const res = await signUpWithPassword('Jane@Co.com', 'password123', 'Jane Doe', { referralCode: 'r1' })
    expect(res).toEqual({ userId: 'u1', error: null, alreadyRegistered: false })
    // normalized email + metadata passed through
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@co.com', password: 'password123' }),
    )
    // verification email triggered for the new user
    expect(functionsInvoke).toHaveBeenCalledWith('send-verification-email', expect.objectContaining({
      body: expect.objectContaining({ email: 'jane@co.com', userId: 'u1', type: 'email_verification' }),
    }))
  })

  it('detects already-registered from the error message', async () => {
    auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })
    const res = await signUpWithPassword('x@y.com', 'password123', 'X')
    expect(res.alreadyRegistered).toBe(true)
    expect(res.userId).toBeNull()
    expect(functionsInvoke).not.toHaveBeenCalled()
  })

  it('detects already-registered from an empty identities array (unconfirmed existing user)', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'u2', identities: [] } }, error: null })
    const res = await signUpWithPassword('x@y.com', 'password123', 'X')
    expect(res.alreadyRegistered).toBe(true)
  })
})

describe('getWorkspaceInvitationSummary', () => {
  it('maps an RPC row into the typed summary', async () => {
    rpc.mockResolvedValue({
      data: [{ workspace_id: 'w1', workspace_name: 'Acme', role: 'member', status: 'pending', email: 'a@b.com', require_email_verification: true }],
      error: null,
    })
    const { data, error } = await getWorkspaceInvitationSummary('tok')
    expect(error).toBeNull()
    expect(data).toEqual({
      workspaceId: 'w1',
      workspaceName: 'Acme',
      role: 'member',
      status: 'pending',
      email: 'a@b.com',
      requireEmailVerification: true,
    })
  })

  it('normalizes an unknown status to "invalid"', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'something_weird' }], error: null })
    const { data } = await getWorkspaceInvitationSummary('tok')
    expect(data?.status).toBe('invalid')
  })
})

describe('acceptWorkspaceInvitation', () => {
  it('propagates the RPC error hint', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope', hint: 'already_accepted' } })
    const res = await acceptWorkspaceInvitation('tok')
    expect(res.error).toBe('nope')
    expect(res.hint).toBe('already_accepted')
    expect(res.workspaceId).toBeNull()
  })

  it('returns the workspaceId on success', async () => {
    rpc.mockResolvedValue({ data: [{ workspace_id: 'w9' }], error: null })
    const res = await acceptWorkspaceInvitation('tok')
    expect(res.error).toBeNull()
    expect(res.workspaceId).toBe('w9')
  })
})
