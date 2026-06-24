import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Input, Label, TextField } from '@heroui/react'

import { updateOwnProfile, updatePassword } from '@/core/auth'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { PasswordInput } from '@/shared/auth/PasswordInput'
import { Seo } from '@/shared/seo/Seo'

import { useAuthStrings } from '../../i18n'

const MIN_PASSWORD = 8

/**
 * complete-profile — STANDARD path only (Telegram variant is a documented NON-GOAL, see AREA §5 /
 * complete-profile.md §5 row 13; it depends on a Telegram OAuth integration absent in apps/next).
 *
 * The signed-in (OAuth) user sets their display name + password and an optional avatar, then we
 * persist via `core/auth.updateOwnProfile` + `updatePassword` and continue to the workbench (`/`).
 * All Supabase access stays behind `core/auth` (island boundary, Constitution X).
 */
export function CompleteProfile() {
  const t = useAuthStrings()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Local-only preview: turn the picked file into an object URL for the Avatar. Persisting the
  // avatar to storage requires upload infra that is not yet wired (see report) — until then the
  // chosen image is shown as a preview but no `avatarUrl` is sent to `updateOwnProfile`.
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUrl(URL.createObjectURL(file))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const trimmedName = name.trim()
    const nameBad = trimmedName.length === 0
    const passwordBad = password.length < MIN_PASSWORD
    setNameError(nameBad)
    setPasswordError(passwordBad)
    if (nameBad || passwordBad) return

    setError(null)
    setSubmitting(true)
    try {
      const profileResult = await updateOwnProfile({ fullName: trimmedName })
      if (profileResult.error) {
        setError(profileResult.error)
        return
      }
      const passwordResult = await updatePassword(password)
      if (passwordResult.error) {
        setError(passwordResult.error)
        return
      }
      navigate('/')
    } catch {
      setError(t.common.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  const initials = name.trim().slice(0, 2).toUpperCase() || '··'

  return (
    <>
      <Seo title={t.completeProfile.title} noindex />
      <AuthScreen title={t.completeProfile.title} subtitle={t.completeProfile.subtitle}>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {/* Avatar (optional) — display current/preview + a "change photo" affordance. */}
          <div className="flex flex-col items-center gap-2">
            <Avatar size="lg">
              {avatarUrl ? <Avatar.Image alt={t.completeProfile.avatarLabel} src={avatarUrl} /> : null}
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
              aria-label={t.completeProfile.avatarLabel}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isDisabled={submitting}
              onPress={() => fileRef.current?.click()}
            >
              {t.completeProfile.avatarChange}
            </Button>
          </div>

          <TextField className="w-full" name="fullName" isRequired isDisabled={submitting}>
            <Label>{t.completeProfile.nameLabel}</Label>
            <Input
              className="w-full"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(false)
              }}
              placeholder={t.completeProfile.namePlaceholder}
              autoComplete="name"
            />
            {nameError ? (
              <p className="text-sm text-danger">{t.completeProfile.nameLabel}</p>
            ) : null}
          </TextField>

          <PasswordInput
            label={t.common.passwordLabel}
            value={password}
            onChange={(value) => {
              setPassword(value)
              if (passwordError) setPasswordError(false)
            }}
            placeholder={t.common.passwordPlaceholder}
            autoComplete="new-password"
            isDisabled={submitting}
            minLength={MIN_PASSWORD}
            showLabel={t.common.showPassword}
            hideLabel={t.common.hidePassword}
          />
          {passwordError ? (
            <p className="text-sm text-danger">{t.signup.passwordRule}</p>
          ) : null}

          {error ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.common.genericError}</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button type="submit" variant="primary" className="w-full" isPending={submitting} isDisabled={submitting}>
            {submitting ? t.completeProfile.submitting : t.completeProfile.submit}
          </Button>
        </form>
      </AuthScreen>
    </>
  )
}
