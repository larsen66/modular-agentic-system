import { Button, Chip, Modal } from '@heroui/react'
import { Gift } from 'lucide-react'
import { useReferral } from '../../hooks/useReferral'
import { useShellStrings } from '../../i18n'
import type { InviteModalProps } from '../../types'
import { ReferralLink } from './ReferralLink'

// Invite modal (legacy InvitePopup → Earn Credits). A focused dialog: centered, blur backdrop.
// Layout/spacing come from Modal.Header/Body/Footer defaults — no custom CSS, only structural
// layout utilities. (Invite-Team / workspace invitations belong to the People area — deferred.)
export function InviteModal({ user, currentOrg, disabled = false, trigger }: InviteModalProps) {
  const t = useShellStrings()
  const referral = useReferral(user?.id, currentOrg?.id)

  return (
    <Modal>
      {trigger ?? (
        <Button isIconOnly variant="ghost" size="md" isDisabled={disabled} aria-label={t.rail.invite.label}>
          <Gift className="size-5" />
        </Button>
      )}
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Gift className="size-5" />
              </Modal.Icon>
              <Modal.Heading>{t.rail.invite.title}</Modal.Heading>
              <p className="text-sm leading-5 text-muted">{t.rail.invite.subtitle}</p>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-5">
                <ol className="flex flex-col gap-3">
                  {t.rail.invite.steps.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-3">
                      <Chip color="accent" size="sm" variant="soft">
                        {i + 1}
                      </Chip>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{step.title}</span>
                        <span className="text-sm text-muted">{step.desc}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t.rail.referral.linkLabel}</span>
                  <ReferralLink link={referral.link} loading={referral.loading} />
                  {referral.usageCount > 0 && (
                    <span className="text-sm text-muted">
                      {referral.usageCount} {t.rail.referral.usedBy}
                    </span>
                  )}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" className="w-full">
                {t.rail.invite.done}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
