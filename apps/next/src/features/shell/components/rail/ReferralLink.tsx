import { useState } from 'react'
import { Button, Input } from '@heroui/react'
import type { ReferralLinkProps } from '../../types'
import { useShellStrings } from '../../i18n'

// Read-only referral link + copy button. Shared by the Invite popover and the Profile menu
// (components/shared = reused by 2+ screens in this module). No custom CSS — HeroUI Input + Button.

export function ReferralLink({ link, loading }: ReferralLinkProps) {
  const t = useShellStrings()
  const [copied, setCopied] = useState(false)

  const onCopy = () => {
    if (!link) return
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        aria-label={t.rail.referral.linkLabel}
        value={loading ? t.rail.referral.loading : (link ?? t.rail.referral.unavailable)}
        className="flex-1"
      />
      <Button size="sm" variant="secondary" isDisabled={!link} onPress={onCopy}>
        {copied ? t.rail.referral.copied : t.rail.referral.copy}
      </Button>
    </div>
  )
}
