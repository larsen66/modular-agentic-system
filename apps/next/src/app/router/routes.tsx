import type { RouteObject } from 'react-router-dom'
import { AppShell } from '../shell/AppShell'
import { Stage } from '../shell/Stage'
import { AuthGuard } from '../auth/AuthGuard'
import { EmailVerificationGate } from '../auth/EmailVerificationGate'
import { OnboardingGate } from '../auth/OnboardingGate'
import {
  Login,
  SignUp,
  ForgotPassword,
  ResetPassword,
  VerifyEmail,
  AuthVerify,
  CompleteProfile,
  AcceptInvite,
} from '@/features/auth'

// Route table (Constitution Principle XI; auth area design/auth/AREA.md). The guard LADDER
// (design/auth/flows/auth-guards.md) wraps every shell route: AuthGuard (session) →
// EmailVerificationGate (verified) → OnboardingGate (onboarded; deferred pass-through) → shell.
// Public auth routes sit OUTSIDE the ladder. The URL is the authority for the active project/chat
// (legacy ADR 0032 scheme):
//   /                              → empty/centered chat (start a new project from a prompt)
//   /project/:projectId            → resolves the main chat, redirects to it
//   /project/:projectId/chat/:chatId → the chat (with ?workspaceId=&surfaceKey= context)
const shell = (
  <AuthGuard>
    <EmailVerificationGate>
      <OnboardingGate>
        <AppShell>
          <Stage />
        </AppShell>
      </OnboardingGate>
    </EmailVerificationGate>
  </AuthGuard>
)

export const routes: RouteObject[] = [
  // Public — auth area (no guard ladder). See design/auth/AREA.md §1.
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignUp /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/auth/verify', element: <AuthVerify /> },
  { path: '/complete-profile', element: <CompleteProfile /> },
  { path: '/accept-invite', element: <AcceptInvite /> },

  // Authenticated shell (guard ladder)
  { path: '/', element: shell },
  { path: '/project/:projectId', element: shell },
  { path: '/project/:projectId/chat/:chatId', element: shell },
  // Settings routes — shell stays; Stage renders SettingsPage when activeMode === 'settings'.
  { path: '/settings', element: shell },
  { path: '/settings/profile', element: shell },
  { path: '/settings/org', element: shell },
  { path: '/settings/workspace', element: shell },
  // Marketplace route — shell stays; Stage renders MarketplacePage when activeMode === 'marketplace'.
  { path: '/marketplace', element: shell },
]
