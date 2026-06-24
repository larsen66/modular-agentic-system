import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Form, Input, Label, TextField } from '@heroui/react'
import { sendResetPasswordEmail } from '@/core/auth'
import { Seo } from '@/shared/seo/Seo'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { useAuthStrings, fmt } from '../../i18n'

const RESEND_COOLDOWN_SECONDS = 60

/**
 * Forgot-Password — the REQUEST half of password recovery (design/auth/screens/forgot-password.md).
 * One email field that, on submit, always advances to a non-enumerating "check your email"
 * confirmation (never reveals whether the account exists — AREA §5). The sent view offers a resend
 * with a 60s cooldown countdown. The link establishes the recovery session on /reset-password.
 */
export function ForgotPassword() {
  const t = useAuthStrings()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drift-free countdown: anchor to a target timestamp, recompute each tick from wall-clock.
  const startCooldown = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const target = Date.now() + RESEND_COOLDOWN_SECONDS * 1000
    setCooldown(RESEND_COOLDOWN_SECONDS)
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000))
      setCooldown(remaining)
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, 250)
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Anti-enumeration: always advance to the sent state, regardless of whether the email exists.
  // A network/transport error is the only thing that keeps us on the form.
  const send = useCallback(
    async (value: string) => {
      setSubmitting(true)
      setError(null)
      const { error: opError } = await sendResetPasswordEmail(value)
      setSubmitting(false)
      if (opError) {
        setError(opError)
        return false
      }
      return true
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const ok = await send(email)
      if (ok) {
        setSent(true)
        startCooldown()
      }
    },
    [email, send, startCooldown],
  )

  const handleResend = useCallback(async () => {
    const ok = await send(email)
    if (ok) startCooldown()
  }, [email, send, startCooldown])

  return (
    <>
      <Seo title={sent ? t.forgotPassword.sentTitle : t.forgotPassword.title} noindex />
      <AuthScreen
        title={sent ? t.forgotPassword.sentTitle : t.forgotPassword.title}
        subtitle={sent ? undefined : t.forgotPassword.subtitle}
        footer={
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {t.common.backToLogin}
          </Link>
        }
      >
        {error ? (
          <Alert status="danger" aria-live="polite">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.common.genericError}</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {sent ? (
          <div className="flex flex-col gap-4">
            <Alert status="success" aria-live="polite">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.forgotPassword.sentTitle}</Alert.Title>
                <Alert.Description>{fmt(t.forgotPassword.sentBody, { email })}</Alert.Description>
              </Alert.Content>
            </Alert>
            <Button
              variant="ghost"
              fullWidth
              isPending={submitting}
              isDisabled={cooldown > 0 || submitting}
              onPress={() => void handleResend()}
            >
              {cooldown > 0
                ? fmt(t.forgotPassword.resendIn, { seconds: cooldown })
                : t.forgotPassword.resend}
            </Button>
          </div>
        ) : (
          <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <TextField
              className="w-full"
              name="email"
              type="email"
              isRequired
              isDisabled={submitting}
              value={email}
              onChange={setEmail}
            >
              <Label>{t.common.emailLabel}</Label>
              <Input className="w-full" placeholder={t.common.emailPlaceholder} autoComplete="email" />
            </TextField>
            <Button type="submit" variant="primary" fullWidth isPending={submitting}>
              {submitting ? t.forgotPassword.submitting : t.forgotPassword.submit}
            </Button>
          </Form>
        )}
      </AuthScreen>
    </>
  )
}

export default ForgotPassword
