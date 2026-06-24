import { Button, Tooltip } from '@heroui/react'
import { PanelRight } from 'lucide-react'
import { TextShimmer } from '@/components/agent-elements/text-shimmer'
import { useChatStrings } from '../i18n'

// Thin gradient overlay + control row sitting above the message list. The breadcrumb "project /
// chat" text is gone — it's replaced by the ChatTabBar above this pane. What remains: the fade so
// messages dissolve at the top, the live provisioning shimmer, and the preview-panel toggle.
export function ChatHeader({
  provisioningLabel,
  showToggle,
  maxWidth,
  onTogglePreview,
}: {
  provisioningLabel: string | null
  showToggle: boolean
  /** Cap to the chat's VISIBLE width when the preview overlaps (same as before). */
  maxWidth?: number
  onTogglePreview: () => void
}) {
  const t = useChatStrings()

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-background/80 to-transparent">
      <div className="pointer-events-auto flex h-full items-center gap-2 px-3" style={{ maxWidth }}>
        {provisioningLabel ? (
          <TextShimmer as="span" className="shrink-0 text-xs font-normal">
            {provisioningLabel}
          </TextShimmer>
        ) : null}
        <div className="flex-1" />
        {showToggle ? (
          <Tooltip delay={300}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t.preview.open}
              onPress={onTogglePreview}
            >
              <PanelRight className="size-4" />
            </Button>
            <Tooltip.Content placement="bottom">{t.preview.open}</Tooltip.Content>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
