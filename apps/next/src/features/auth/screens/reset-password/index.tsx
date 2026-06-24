import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Spinner } from '@heroui/react'
import { getCurrentUser, updatePassword } from '@/core/auth'
import { Seo } from '@/shared/seo/Seo'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { PasswordInput } from '@/shared/auth/PasswordInput'
import { useAuthStrings } from '../../i18n'

const MIN_PASSWORD_LENGTH = 8
const SUCCESS_REDIRECT_MS = 2000

type SessionState = 'checking' | 'present' | 'absent'

/**
 * Reset-Password — the COMPLETION half of password recovery (design/auth/screens/reset-password.md).
 * Gated on the Supabase recovery session established by the email link (detected via getCurrentUser).
 * No session → invalid/expired-link view. Session present → new + confirm password fields
 * (min 8, must match) → updatePassword → success → /login. Errors surface inline (AREA §5).
 */
export function ResetPassword() {
  const t = useAuthStrings()
  const navigate = useNavigate()
  const [sessionState, setSessionState] = useState<SessionState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let active = true
    void getCurrentUser().then((user) => {
      if (active) setSessionState(user ? 'present' : 'absent')
    })
    return () => {
      active = false
    }
  }, [])

  // 2s redirect to /login after a successful change (a button is also offered).
  useEffect(() => {
    if (!success) return
    const id = setTimeout(() => navigate('/login'), SUCCESS_REDIRECT_MS)
    return () => clearTimeout(id)
  }, [success, navigate])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setFieldError(null)
      setOpError(null)

      if (password.length < MIN_PASSWORD_LENGTH) {
        setFieldError(t.resetPassword.tooShort)
        return
      }
      if (password !== confirm) {
        setFieldError(t.resetPassword.mismatch)
        return
      }

      setSubmitting(true)
      const { error } = await updatePassword(password)
      setSubmitting(false)
      if (error) {
        setOpError(error)
        return
      }
      setSuccess(true)
    },
    [password, confirm, t],
  )

  // --- Resolving the recovery session ---
  if (sessionState === 'checking') {
    return (
      <>
        <Seo title={t.resetPassword.title} noindex />
        <AuthScreen title={t.resetPassword.title}>
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        </AuthScreen>
      </>
    )
  }

  // --- Invalid / expired link (no recovery session) ---
  if (sessionState === 'absent') {
    return (
      <>
        <Seo title={t.resetPassword.invalidLinkTitle} noindex />
        <AuthScreen
          title={t.resetPassword.invalidLinkTitle}
          subtitle={t.resetPassword.invalidLinkBody}
          footer={
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
              {t.resetPassword.requestNew}
            </Link>
          }
        >
          <Alert status="danger" aria-live="polite">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.resetPassword.invalidLinkTitle}</Alert.Title>
              <Alert.Description>{t.resetPassword.invalidLinkBody}</Alert.Description>
            </Alert.Content>
          </Alert>
        </AuthScreen>
      </>
    )
  }

  // --- Success view ---
  if (success) {
    return (
      <>
        <Seo title={t.resetPassword.successTitle} noindex />
        <AuthScreen title={t.resetPassword.successTitle} subtitle={t.resetPassword.successBody}>
          <Alert status="success" aria-live="polite">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.resetPassword.successTitle}</Alert.Title>
              <Alert.Description>{t.resetPassword.successBody}</Alert.Description>
            </Alert.Content>
          </Alert>
          <Button variant="primary" fullWidth onPress={() => navigate('/login')}>
            {t.common.backToLogin}
          </Button>
        </AuthScreen>
      </>
    )
  }

  // --- Set-password view (recovery session present) ---
  return (
    <>
      <Seo title={t.resetPassword.title} noindex />
      <AuthScreen title={t.resetPassword.title} subtitle={t.resetPassword.subtitle}>
        {opError ? (
          <Alert status="danger" aria-live="polite">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.common.genericError}</Alert.Title>
              <Alert.Description>{opError}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <PasswordInput
            label={t.resetPassword.newPasswordLabel}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            isDisabled={submitting}
            minLength={MIN_PASSWORD_LENGTH}
            showLabel={t.common.showPassword}
            hideLabel={t.common.hidePassword}
          />
          <PasswordInput
            label={t.resetPassword.confirmPasswordLabel}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            isDisabled={submitting}
            minLength={MIN_PASSWORD_LENGTH}
            showLabel={t.common.showPassword}
            hideLabel={t.common.hidePassword}
          />
          {fieldError ? (
            <Alert status="danger" aria-live="polite">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{fieldError}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <Button type="submit" variant="primary" fullWidth isPending={submitting}>
            {submitting ? t.resetPassword.submitting : t.resetPassword.submit}
          </Button>
        </Form>
      </AuthScreen>
    </>
  )
}

export default ResetPassword
