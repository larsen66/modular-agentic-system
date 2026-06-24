import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Input, Label, Separator, TextField } from '@heroui/react'
import { getCurrentUser, signInWithPassword } from '@/core/auth'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { PasswordInput } from '@/shared/auth/PasswordInput'
import { Seo } from '@/shared/seo/Seo'
import { OAuthButtons } from '../../components/shared/OAuthButtons'
import { MagicLinkButton } from '../../components/shared/MagicLinkButton'
import { useAuthStrings } from '../../i18n'
import type { AuthLocationState } from '../../types'

// Login screen — composition only (ARCHITECTURE §3). Email + password sign-in plus the alternate
// identity paths (Google OAuth, magic-link) and cross-links (forgot-password, signup). Credential
// failures surface inline as an Alert (BA113 — never a toast); success navigates through the guard
// ladder via returnTo. All ops go through core/auth; no Supabase client here ([[VIII]]/[[X]]).
export function Login() {
  const t = useAuthStrings()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as AuthLocationState | null)?.returnTo ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  // Already signed in → bounce away. The guard ladder owns admission; this screen assumes anon.
  useEffect(() => {
    let active = true
    void getCurrentUser().then((user) => {
      if (active && user) navigate(returnTo, { replace: true })
    })
    return () => {
      active = false
    }
  }, [navigate, returnTo])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const result = await signInWithPassword(email, password)
    setIsSubmitting(false)
    if (result) {
      setError(result || t.login.invalidCredentials)
      return
    }
    navigate(returnTo, { replace: true })
  }

  const controlsDisabled = isSubmitting

  return (
    <>
      <Seo title={t.login.title} noindex />
      <AuthScreen
        title={t.login.title}
        subtitle={t.login.subtitle}
        footer={
          <span className="text-sm">
            {t.login.noAccount}{' '}
            <Link to="/signup" className="underline">
              {t.login.signUpLink}
            </Link>
          </span>
        }
      >
        {error ? (
          <Alert status="danger" aria-live="assertive">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <OAuthButtons isDisabled={controlsDisabled} onError={setError} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-sm text-default-400">{t.common.or}</span>
          <Separator className="flex-1" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <TextField className="w-full" name="email" isRequired isDisabled={controlsDisabled}>
            <Label>{t.common.emailLabel}</Label>
            <Input
              className="w-full"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.common.emailPlaceholder}
              autoComplete="email"
            />
          </TextField>

          <PasswordInput
            label={t.common.passwordLabel}
            value={password}
            onChange={setPassword}
            placeholder={t.common.passwordPlaceholder}
            autoComplete="current-password"
            isDisabled={controlsDisabled}
            showLabel={t.common.showPassword}
            hideLabel={t.common.hidePassword}
          />

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm underline">
              {t.login.forgotPassword}
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-full" isPending={isSubmitting} isDisabled={controlsDisabled}>
            {isSubmitting ? t.login.submitting : t.login.submit}
          </Button>
        </form>

        <div className="text-center">
          <MagicLinkButton
            email={email}
            isDisabled={controlsDisabled}
            onError={setError}
            onSent={() => setMagicLinkSent(true)}
          />
          {magicLinkSent ? (
            <p className="mt-2 text-sm text-default-400" aria-live="polite">
              {t.common.magicLinkSent}
            </p>
          ) : null}
        </div>
      </AuthScreen>
    </>
  )
}
