import { useState } from 'react'
import { Button, Popover } from '@heroui/react'
import { Gift } from 'lucide-react'
import type { InviteCopyActionProps } from '../../types'
import { useReferral } from '../../hooks/useReferral'
import { useShellStrings } from '../../i18n'

// Profile menu action: "Invite & earn credits" with a small inline hint. Clicking copies the
// referral link and shows a brief, minimal confirmation popover to the right — no modal, no
// full-width link. Native HeroUI (Button + controlled Popover), no custom CSS.

export function InviteCopyAction({ user, currentOrg }: InviteCopyActionProps) {
  const t = useShellStrings()
  const { link } = useReferral(user?.id, currentOrg?.id)
  const [open, setOpen] = useState(false)

  const onCopy = () => {
    if (!link) return
    void navigator.clipboard.writeText(link).then(() => {
      setOpen(true)
      window.setTimeout(() => setOpen(false), 2200)
    })
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        isDisabled={!link}
        onPress={onCopy}
      >
        <Gift className="size-4" />
        <span>{t.rail.profile.inviteEarn}</span>
        <span className="text-[10px] text-muted">{t.rail.profile.inviteHint}</span>
      </Button>
      <Popover.Content className="w-56" placement="right" shouldFlip={false}>
        <Popover.Dialog>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t.rail.profile.linkCopied}</span>
            <span className="text-sm text-muted">{t.rail.invite.subtitle}</span>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
