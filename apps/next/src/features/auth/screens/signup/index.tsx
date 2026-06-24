import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Chip, Input, Label, Separator, TextField } from '@heroui/react'
import { signUpWithPassword } from '@/core/auth'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { PasswordInput } from '@/shared/auth/PasswordInput'
import { Seo } from '@/shared/seo/Seo'
import { capturePendingReferralFromUrl } from '@/shared/referral'
import { readFirstRunIntentPromptForSignup } from '@/shared/firstRunIntent'
import { OAuthButtons } from '../../components/shared/OAuthButtons'
import { MagicLinkButton } from '../../components/shared/MagicLinkButton'
import { useAuthStrings } from '../../i18n'
import type { AuthLocationState } from '../../types'

// SignUp screen — composition only (ARCHITECTURE §3). Name + email + password account creation plus
// the alternate identity paths (Google OAuth, magic-link). Carries referral + first-run-intent into
// the signup op, bounces a duplicate email back to /login prefilled, and hands off to /verify-email
// on success. All ops go through core/auth; no Supabase client here ([[VIII]]/[[X]]).
const PASSWORD_MIN_LENGTH = 8

export function SignUp() {
  const t = useAuthStrings()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  // Capture an inbound ?ref= referral code once on mount so it survives until the signup op reads it.
  useEffect(() => {
    capturePendingReferralFromUrl()
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const referralCode = capturePendingReferralFromUrl() ?? undefined
    const result = await signUpWithPassword(email, password, fullName, {
      referralCode,
      landingIntentPrompt: readFirstRunIntentPromptForSignup() ?? undefined,
    })
    setIsSubmitting(false)

    if (result.alreadyRegistered) {
      navigate('/login', { state: { email } satisfies AuthLocationState })
      return
    }
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/verify-email', {
      state: { email, userId: result.userId ?? undefined } satisfies AuthLocationState,
    })
  }

  const controlsDisabled = isSubmitting

  return (
    <>
      <Seo title={t.signup.title} noindex />
      <AuthScreen
        title={t.signup.title}
        subtitle={t.signup.subtitle}
        footer={
          <span className="text-sm">
            {t.signup.haveAccount}{' '}
            <Link to="/login" className="underline">
              {t.signup.signInLink}
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
          <TextField className="w-full" name="fullName" isRequired isDisabled={controlsDisabled}>
            <Label>{t.signup.nameLabel}</Label>
            <Input
              className="w-full"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t.signup.namePlaceholder}
              autoComplete="name"
            />
          </TextField>

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

          <div className="flex flex-col gap-1">
            <PasswordInput
              label={t.common.passwordLabel}
              value={password}
              onChange={setPassword}
              placeholder={t.common.passwordPlaceholder}
              autoComplete="new-password"
              isDisabled={controlsDisabled}
              minLength={PASSWORD_MIN_LENGTH}
              showLabel={t.common.showPassword}
              hideLabel={t.common.hidePassword}
            />
            <p className="text-sm text-default-400">{t.signup.passwordRule}</p>
          </div>

          <Button type="submit" variant="primary" className="w-full" isPending={isSubmitting} isDisabled={controlsDisabled}>
            {isSubmitting ? t.signup.submitting : t.signup.submit}
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

        <div className="flex flex-wrap justify-center gap-2">
          <Chip variant="soft" size="sm">
            {t.signup.trustFree}
          </Chip>
          <Chip variant="soft" size="sm">
            {t.signup.trustCredits}
          </Chip>
          <Chip variant="soft" size="sm">
            {t.signup.trustNoCard}
          </Chip>
        </div>
      </AuthScreen>
    </>
  )
}
