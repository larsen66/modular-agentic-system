import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Chip, Spinner } from '@heroui/react'
import { resendVerificationEmail, signOut } from '@/core/auth'
import { Seo } from '@/shared/seo/Seo'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { useUiStore } from '@/state/uiStore'
import { useAuthStrings, fmt } from '../../i18n'
import type { AuthLocationState } from '../../types'

const COOLDOWN_SECONDS = 60

/**
 * Post-signup "check your email" holding page (design/auth/screens/verify-email.md).
 *
 * Passive surface: the user proceeds by clicking the link in their inbox (which lands on
 * /auth/verify), not by acting here. We echo the address the link was sent to, offer a
 * rate-limited resend (one send / 60s, drift-free single interval), and a "different account"
 * escape that signs out and returns to /login. Reads email/userId from router state; if neither is
 * present we render generic copy + a back-to-login link rather than an empty page.
 */
export function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useAuthStrings()
  const locale = useUiStore((s) => s.language)

  const state = (location.state as AuthLocationState | null) ?? null
  const email = state?.email?.trim() || ''
  const userId = state?.userId || ''

  // Cooldown is computed from a target timestamp so it's drift-free and StrictMode-safe (no chained
  // per-render setTimeout). `cooldownUntil` is the epoch ms at which the next resend is allowed.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [sending, setSending] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [resent, setResent] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // One interval, keyed on the target timestamp; cleared on unmount or when the target changes.
  useEffect(() => {
    if (cooldownUntil === null) {
      setSecondsLeft(0)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) setCooldownUntil(null)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [cooldownUntil])

  const handleResend = useCallback(async () => {
    if (sending || secondsLeft > 0 || !email || !userId) return
    setSending(true)
    setErrorMsg(null)
    setResent(false)
    const { error } = await resendVerificationEmail(email, userId, locale)
    setSending(false)
    if (error) {
      // Failure does NOT start the cooldown — let the user retry immediately.
      setErrorMsg(error)
      return
    }
    setResent(true)
    setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000)
  }, [sending, secondsLeft, email, userId, locale])

  const handleDifferentAccount = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    navigate('/login')
  }, [signingOut, navigate])

  const cooldownActive = secondsLeft > 0

  // No identity in state — render a graceful generic holding page with a back-to-login escape.
  if (!email) {
    return (
      <>
        <Seo title={t.verifyEmail.title} noindex />
        <AuthScreen title={t.verifyEmail.title}>
          <p className="text-sm text-muted-foreground">{t.verifyEmail.title}</p>
          <Button variant="ghost" className="w-full" onPress={() => navigate('/login')}>
            {t.common.backToLogin}
          </Button>
        </AuthScreen>
      </>
    )
  }

  return (
    <>
      <Seo title={t.verifyEmail.title} noindex />
      <AuthScreen title={t.verifyEmail.title}>
        <p className="text-sm text-muted-foreground">{fmt(t.verifyEmail.body, { email })}</p>
        <div>
          <Chip variant="soft" color="accent">
            {email}
          </Chip>
        </div>

        {resent ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.verifyEmail.resent}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {errorMsg ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{errorMsg}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        <Button
          variant="secondary"
          className="w-full"
          isPending={sending}
          isDisabled={cooldownActive || sending}
          onPress={handleResend}
        >
          {sending ? <Spinner color="current" size="sm" /> : null}
          {cooldownActive ? fmt(t.verifyEmail.resendIn, { seconds: secondsLeft }) : t.verifyEmail.resend}
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          isPending={signingOut}
          isDisabled={signingOut}
          onPress={handleDifferentAccount}
        >
          {t.verifyEmail.differentAccount}
        </Button>
      </AuthScreen>
    </>
  )
}
