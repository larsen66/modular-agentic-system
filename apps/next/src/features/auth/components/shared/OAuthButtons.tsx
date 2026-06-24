import { useState } from 'react'
import { Button } from '@heroui/react'
import { signInWithOAuth, type OAuthProvider } from '@/core/auth'
import { useAuthStrings } from '../../i18n'

// Google + GitHub OAuth buttons, shared by Login and SignUp. Each press starts a PKCE redirect to
// the provider (core/auth.signInWithOAuth); on success the browser navigates away, so we only
// handle the error branch. Reports failures up via onError for the parent's inline Alert.
export function OAuthButtons({ isDisabled, onError }: { isDisabled?: boolean; onError?: (msg: string) => void }) {
  const t = useAuthStrings()
  const [pending, setPending] = useState<OAuthProvider | null>(null)

  async function go(provider: OAuthProvider) {
    setPending(provider)
    const { error } = await signInWithOAuth(provider)
    if (error) {
      setPending(null)
      onError?.(error)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        className="w-full"
        isPending={pending === 'google'}
        isDisabled={isDisabled || pending !== null}
        onPress={() => go('google')}
      >
        {t.common.continueWithGoogle}
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        isPending={pending === 'github'}
        isDisabled={isDisabled || pending !== null}
        onPress={() => go('github')}
      >
        {t.common.continueWithGitHub}
      </Button>
    </div>
  )
}
