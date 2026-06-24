import { useState } from 'react'
import { Button } from '@heroui/react'
import { signInWithMagicLink } from '@/core/auth'
import { useAuthStrings } from '../../i18n'

// Passwordless magic-link request, shared by Login and SignUp. Sends an OTP sign-in email to the
// address currently typed in the form; the parent shows the "check your inbox" confirmation via
// onSent. Guards against an empty email so the user gets a clear inline message.
export function MagicLinkButton({
  email,
  isDisabled,
  onError,
  onSent,
}: {
  email: string
  isDisabled?: boolean
  onError?: (msg: string) => void
  onSent?: () => void
}) {
  const t = useAuthStrings()
  const [pending, setPending] = useState(false)

  async function go() {
    if (!email.trim()) {
      onError?.(t.common.enterEmailFirst)
      return
    }
    setPending(true)
    const { error } = await signInWithMagicLink(email)
    setPending(false)
    if (error) onError?.(error)
    else onSent?.()
  }

  return (
    <Button variant="ghost" className="w-full" isPending={pending} isDisabled={isDisabled} onPress={go}>
      {t.common.magicLink}
    </Button>
  )
}
