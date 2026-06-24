// Permission request card (mined: src/components/Chat/UX2/PermissionRequestCard.tsx + the
// /sessions/:id/permissions/:id/respond endpoint). The agent asks before a non-auto-granted action
// (write/bash/…); the user allows-once / allows / denies. Minimalist HeroUI v3 (Card + Buttons).

import { Button, Card, Chip } from '@heroui/react'
import { useChatStrings } from '../../i18n'
import type { PendingPermission } from '../../types'

interface PermissionCardProps {
  permission: PendingPermission
  onRespond?: (action: 'allow_once' | 'allow' | 'deny') => void
}

export function PermissionCard({ permission, onRespond }: PermissionCardProps) {
  const t = useChatStrings()
  const target = permission.filePath ?? permission.patterns?.join(', ')
  if (permission.decided) {
    const label = permission.decided === 'deny' ? t.notices.denied : permission.decided === 'allow' ? t.notices.allowed : t.notices.allowedOnce
    return (
      <Card data-testid="permission-card" data-decided={permission.decided}>
        <Card.Header className="flex items-center gap-2">
          <Chip color={permission.decided === 'deny' ? 'danger' : 'success'}>{label}</Chip>
          <Card.Description>{permission.toolName ?? permission.permissionKind}{target ? ` · ${target}` : ''}</Card.Description>
        </Card.Header>
      </Card>
    )
  }
  return (
    <Card data-testid="permission-card">
      <Card.Header>
        <Card.Title>{t.notices.permissionNeeded}</Card.Title>
        <Card.Description>
          {t.notices.permissionBodyTool} <b>{permission.toolName ?? permission.permissionKind}</b>{target ? <> {t.notices.permissionBodyOn} <b>{target}</b></> : null}.
        </Card.Description>
      </Card.Header>
      <Card.Footer className="flex gap-2">
        <Button variant="danger-soft" onPress={() => onRespond?.('deny')}>{t.notices.deny}</Button>
        <Button variant="secondary" onPress={() => onRespond?.('allow_once')}>{t.notices.allowOnce}</Button>
        <Button onPress={() => onRespond?.('allow')}>{t.notices.allow}</Button>
      </Card.Footer>
    </Card>
  )
}
