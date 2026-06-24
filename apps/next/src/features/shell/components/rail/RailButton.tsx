import { Button, Tooltip } from '@heroui/react'
import type { RailButtonProps } from '../../types'

// One rail affordance: an icon-only Button in a Tooltip. Active state is expressed with a HeroUI
// variant (filled `secondary` vs `ghost`) — no custom indicator markup. No custom CSS.
export function RailButton({
  icon,
  label,
  active = false,
  isDisabled = false,
  onPress,
  tooltip,
  'aria-label': ariaLabel,
}: RailButtonProps) {
  return (
    <Tooltip delay={300}>
      <Button
        isIconOnly
        variant={active ? 'secondary' : 'ghost'}
        size="md"
        isDisabled={isDisabled}
        onPress={onPress}
        aria-label={ariaLabel}
      >
        {icon}
      </Button>
      <Tooltip.Content placement="right">{tooltip ?? label}</Tooltip.Content>
    </Tooltip>
  )
}
