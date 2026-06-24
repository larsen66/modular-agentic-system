import type { ReactNode } from 'react'
import { Card } from '@heroui/react'

// Shared full-viewport chrome for every auth screen (design/auth/AREA.md §5). One home for the
// centered Card shell: title, optional subtitle, the screen's body, and an optional footer slot
// (cross-links / secondary actions). HeroUI-only; structural layout utilities solely for centering.
export interface AuthScreenProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <Card.Header>
          <Card.Title>{title}</Card.Title>
          {subtitle ? <Card.Description>{subtitle}</Card.Description> : null}
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">{children}</Card.Content>
        {footer ? <Card.Footer className="justify-center">{footer}</Card.Footer> : null}
      </Card>
    </div>
  )
}
