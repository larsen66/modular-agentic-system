import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Chip, Spinner } from '@heroui/react'
import { AlertTriangle, CheckCircle, UserPlus, XCircle } from 'lucide-react'

import {
  acceptWorkspaceInvitation,
  getCurrentUser,
  getWorkspaceInvitationSummary,
  isEmailVerified,
  resendVerificationEmail,
  type InvitationSummary,
} from '@/core/auth'
import { capturePendingReferralFromUrl, clearPendingReferral } from '@/shared/referral'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { Seo } from '@/shared/seo/Seo'

import { fmt, useAuthStrings } from '../../i18n'

const PENDING_INVITE_KEY = 'pendingInviteToken'

/**
 * The eight mutually-exclusive view-states (accept-invite.md §3 — parity-critical, none may be
 * dropped). Each is "at rest". A union + exhaustive switch makes a dropped state a compile error.
 */
type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; summary: InvitationSummary; authed: boolean }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'accepted'; summary: InvitationSummary | null }
  | { kind: 'alreadyMember'; summary: InvitationSummary }
  | { kind: 'wrongAccount'; invitedEmail: string }
  | { kind: 'needsEmailVerification'; summary: InvitationSummary; email: string; userId: string }
  | { kind: 'declined' }

function stashToken(token: string): void {
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, token)
  } catch {
    /* best-effort */
  }
}

/**
 * accept-invite — the destination of a workspace-invitation link (`/accept-invite?token=…`).
 * Loads the summary via an anonymous RPC, resolves which of eight states applies, and lets an
 * authenticated invitee accept/decline (or routes an unauthenticated invitee through sign-in/up
 * with the token stashed). All Supabase access stays behind `core/auth` (island boundary).
 */
export function AcceptInvite() {
  const t = useAuthStrings()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [accepting, setAccepting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Capture `?ref=` on mount (consumed on accept success). Best-effort.
  useEffect(() => {
    capturePendingReferralFromUrl(window.location.search)
  }, [])

  // Resolve the view-state from summary + session.
  useEffect(() => {
    let cancelled = false
    async function resolve() {
      if (!token) {
        if (!cancelled) setState({ kind: 'invalid' })
        return
      }
      const { data: summary, error } = await getWorkspaceInvitationSummary(token)
      if (cancelled) return
      if (error || !summary) {
        setState({ kind: 'invalid' })
        return
      }
      // Status-driven terminal states first.
      if (summary.status === 'revoked' || summary.status === 'invalid') {
        setState({ kind: 'invalid' })
        return
      }
      if (summary.status === 'expired') {
        setState({ kind: 'expired' })
        return
      }
      if (summary.status === 'accepted') {
        setState({ kind: 'accepted', summary })
        return
      }

      // status === 'pending' — branch on auth state.
      const user = await getCurrentUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'ready', summary, authed: false })
        return
      }

      // wrongAccount: invited email present and does not match the session email (case-insensitive).
      const invitedEmail = summary.email?.trim().toLowerCase() ?? null
      const sessionEmail = user.email?.trim().toLowerCase() ?? null
      if (invitedEmail && sessionEmail && invitedEmail !== sessionEmail) {
        setState({ kind: 'wrongAccount', invitedEmail: summary.email ?? invitedEmail })
        return
      }

      // needsEmailVerification: org requires a verified email and the account is unverified.
      if (summary.requireEmailVerification && !isEmailVerified(user)) {
        setState({
          kind: 'needsEmailVerification',
          summary,
          email: user.email ?? '',
          userId: user.id,
        })
        return
      }

      setState({ kind: 'ready', summary, authed: true })
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onAccept(summary: InvitationSummary) {
    if (accepting) return
    setActionError(null)
    setAccepting(true)
    try {
      const result = await acceptWorkspaceInvitation(token)
      if (result.error) {
        // Map RPC HINTs to the right terminal state; otherwise stay on screen with an inline error.
        switch (result.hint) {
          case 'invalid_token':
            setState({ kind: 'invalid' })
            return
          case 'expired':
            setState({ kind: 'expired' })
            return
          case 'already_accepted':
            setState({ kind: 'accepted', summary })
            return
          case 'email_mismatch':
            setState({ kind: 'wrongAccount', invitedEmail: summary.email ?? '' })
            return
          case 'email_verification_required': {
            const user = await getCurrentUser()
            setState({
              kind: 'needsEmailVerification',
              summary,
              email: user?.email ?? summary.email ?? '',
              userId: user?.id ?? '',
            })
            return
          }
          default:
            setActionError(result.error)
            return
        }
      }
      // Success: consume the referral and continue to the workbench.
      clearPendingReferral()
      navigate('/')
    } catch {
      setActionError(t.common.genericError)
    } finally {
      setAccepting(false)
    }
  }

  function onDecline() {
    // Decline writes nothing server-side; just render the declined terminal view.
    setState({ kind: 'declined' })
  }

  async function onResend(email: string, userId: string) {
    if (resending || !email || !userId) return
    setActionError(null)
    setResending(true)
    try {
      const result = await resendVerificationEmail(email, userId)
      if (result.error) {
        setActionError(result.error)
        return
      }
      setResent(true)
    } catch {
      setActionError(t.common.genericError)
    } finally {
      setResending(false)
    }
  }

  function goToUnauth(target: '/login' | '/signup') {
    if (token) stashToken(token)
    const returnTo = `/accept-invite?token=${encodeURIComponent(token)}`
    navigate(`${target}?returnTo=${encodeURIComponent(returnTo)}`)
  }

  // ── Render: exhaustive switch over the eight states ──────────────────────────────────────────
  switch (state.kind) {
    case 'loading':
      return (
        <>
          <Seo title={t.acceptInvite.loading} noindex />
          <AuthScreen title={t.acceptInvite.loading}>
            <div className="flex justify-center py-6">
              <Spinner color="accent" size="lg" />
            </div>
          </AuthScreen>
        </>
      )

    case 'ready': {
      const { summary, authed } = state
      const workspace = summary.workspaceName ?? ''
      const role = summary.role ?? ''
      return (
        <>
          <Seo title={t.acceptInvite.readyTitle} noindex />
          <AuthScreen title={t.acceptInvite.readyTitle}>
            <div className="flex flex-col items-center gap-3 text-center">
              <UserPlus className="size-8 text-accent" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {fmt(t.acceptInvite.readyBody, { workspace, role })}
              </p>
              {role ? <Chip variant="soft">{role}</Chip> : null}
            </div>
            {actionError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t.common.genericError}</Alert.Title>
                  <Alert.Description>{actionError}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {authed ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="w-full"
                  isPending={accepting}
                  isDisabled={accepting}
                  onPress={() => onAccept(summary)}
                >
                  {accepting ? t.acceptInvite.accepting : t.acceptInvite.accept}
                </Button>
                <Button variant="ghost" className="w-full" isDisabled={accepting} onPress={onDecline}>
                  {t.acceptInvite.decline}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button variant="primary" className="w-full" onPress={() => goToUnauth('/login')}>
                  {t.acceptInvite.signInCta}
                </Button>
                <Button variant="outline" className="w-full" onPress={() => goToUnauth('/signup')}>
                  {t.acceptInvite.signUpCta}
                </Button>
              </div>
            )}
          </AuthScreen>
        </>
      )
    }

    case 'invalid':
      return (
        <StatusView
          icon={<XCircle className="size-8 text-danger" aria-hidden />}
          title={t.acceptInvite.invalidTitle}
          status="danger"
          body={t.acceptInvite.invalidBody}
          cta={
            <Button variant="primary" className="w-full" onPress={() => navigate('/')}>
              {t.acceptInvite.goToWorkspace}
            </Button>
          }
        />
      )

    case 'expired':
      return (
        <StatusView
          icon={<AlertTriangle className="size-8 text-warning" aria-hidden />}
          title={t.acceptInvite.expiredTitle}
          status="warning"
          body={t.acceptInvite.expiredBody}
          cta={
            <Button variant="primary" className="w-full" onPress={() => navigate('/')}>
              {t.acceptInvite.goToWorkspace}
            </Button>
          }
        />
      )

    case 'accepted': {
      const workspace = state.summary?.workspaceName ?? ''
      return (
        <StatusView
          icon={<CheckCircle className="size-8 text-success" aria-hidden />}
          title={t.acceptInvite.acceptedTitle}
          status="success"
          body={fmt(t.acceptInvite.acceptedBody, { workspace })}
          cta={
            <Button variant="primary" className="w-full" onPress={() => navigate('/')}>
              {t.acceptInvite.goToWorkspace}
            </Button>
          }
        />
      )
    }

    case 'alreadyMember': {
      const workspace = state.summary.workspaceName ?? ''
      return (
        <StatusView
          icon={<CheckCircle className="size-8 text-success" aria-hidden />}
          title={t.acceptInvite.alreadyMemberTitle}
          status="success"
          body={fmt(t.acceptInvite.alreadyMemberBody, { workspace })}
          cta={
            <Button variant="primary" className="w-full" onPress={() => navigate('/')}>
              {t.acceptInvite.goToWorkspace}
            </Button>
          }
        />
      )
    }

    case 'wrongAccount':
      return (
        <StatusView
          icon={<AlertTriangle className="size-8 text-warning" aria-hidden />}
          title={t.acceptInvite.wrongAccountTitle}
          status="warning"
          body={fmt(t.acceptInvite.wrongAccountBody, { email: state.invitedEmail })}
          cta={
            <Button
              variant="primary"
              className="w-full"
              onPress={() => navigate(`/login?hint=${encodeURIComponent(state.invitedEmail)}`)}
            >
              {fmt(t.acceptInvite.wrongAccountSignIn, { email: state.invitedEmail })}
            </Button>
          }
        />
      )

    case 'needsEmailVerification': {
      const { summary, email, userId } = state
      const workspace = summary.workspaceName ?? ''
      return (
        <>
          <Seo title={t.acceptInvite.needsVerificationTitle} noindex />
          <AuthScreen title={t.acceptInvite.needsVerificationTitle}>
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="size-8 text-warning" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {fmt(t.acceptInvite.needsVerificationBody, { workspace })}
              </p>
            </div>
            {resent ? (
              <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t.verifyEmail.resent}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
            {actionError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t.common.genericError}</Alert.Title>
                  <Alert.Description>{actionError}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="w-full"
                isPending={resending}
                isDisabled={resending}
                onPress={() => onResend(email, userId)}
              >
                {t.acceptInvite.resendVerification}
              </Button>
              <Button variant="ghost" className="w-full" onPress={() => navigate('/')}>
                {t.acceptInvite.goToWorkspace}
              </Button>
            </div>
          </AuthScreen>
        </>
      )
    }

    case 'declined':
      return (
        <StatusView
          icon={<XCircle className="size-8 text-muted-foreground" aria-hidden />}
          title={t.acceptInvite.declinedTitle}
          status="accent"
          cta={
            <Button variant="primary" className="w-full" onPress={() => navigate('/')}>
              {t.acceptInvite.goToWorkspace}
            </Button>
          }
        />
      )

    default: {
      // Exhaustiveness guard — a new ViewState without a case is a compile error.
      const _never: never = state
      return _never
    }
  }
}

/** Data-driven terminal status block (invalid / expired / accepted / alreadyMember / wrongAccount). */
function StatusView(props: {
  icon: React.ReactNode
  title: string
  status: 'danger' | 'warning' | 'success' | 'accent'
  body?: string
  cta: React.ReactNode
}) {
  return (
    <>
      <Seo title={props.title} noindex />
      <AuthScreen title={props.title}>
        <div className="flex flex-col items-center gap-3 text-center">{props.icon}</div>
        <Alert status={props.status}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{props.title}</Alert.Title>
            {props.body ? <Alert.Description>{props.body}</Alert.Description> : null}
          </Alert.Content>
        </Alert>
        {props.cta}
      </AuthScreen>
    </>
  )
}