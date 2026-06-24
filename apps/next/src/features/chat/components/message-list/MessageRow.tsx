// One transcript row (design: docs/design/chat/screens/message-list.md, Variant A).
// HeroUI v3 + established island tokens only; no custom CSS. v1 renders the row skeleton
// (user/assistant text, model chip, streaming spinner, error, reasoning, pending-question answer).
// Rich agent-activity (tool rows, diffs) + the full notice set arrive with the gpt-5.5 rendering docs.

import { useState } from 'react'
import { Button, Card, Chip, Spinner, TextArea } from '@heroui/react'
import { AgentActivity } from './AgentActivity'
import { PermissionCard } from './PermissionCard'
import { FailoverNotice, GitStatusChip, InsufficientBalanceCard, VisualVerificationNotice } from './Notices'
import { useChatStrings } from '../../i18n'
import type { MessageRowProps } from '../../types'

export function MessageRow({ message, onAnswer, onPermissionRespond, onTopUp }: MessageRowProps) {
  const t = useChatStrings()
  const [answer, setAnswer] = useState('')
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end" data-testid="message-user">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-default-200 px-3 py-2 text-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  const showQuestion = message.question && !message.question.answered
  const isError = message.status === 'error' || !!message.errorCode

  return (
    <div className="flex flex-col gap-2" data-testid="message-assistant" data-status={message.status}>
      <div className="flex items-center gap-2">
        {message.model && <Chip>{message.model}</Chip>}
        {message.status === 'streaming' && <Spinner size="sm" aria-label={t.transcript.generating} />}
      </div>

      {message.failover && <FailoverNotice requested={message.failover.requested} actual={message.failover.actual} reason={message.failover.reason} />}

      <AgentActivity message={message} />

      {message.visualVerification && <VisualVerificationNotice status={message.visualVerification.status} />}

      {message.permission && (
        <PermissionCard
          permission={message.permission}
          onRespond={onPermissionRespond ? (action) => onPermissionRespond(message.permission!.permissionId, action) : undefined}
        />
      )}

      {message.handoff && (
        <Card data-testid="handoff-banner">
          <Card.Header><Card.Title>{t.notices.supportNotified}</Card.Title></Card.Header>
          <Card.Description>{t.notices.supportBody}</Card.Description>
        </Card>
      )}

      {message.text && <div className="whitespace-pre-wrap text-foreground">{message.text}</div>}

      {message.gitStatus && <GitStatusChip status={message.gitStatus} />}

      {isError && message.errorCode === 'insufficient_balance' ? (
        <InsufficientBalanceCard onTopUp={onTopUp} />
      ) : isError ? (
        <Card data-testid="message-error">
          <Card.Header className="flex items-center gap-2">
            <Chip color="danger">{message.errorCode ?? 'error'}</Chip>
            <Card.Title>{t.notices.somethingWrong}</Card.Title>
          </Card.Header>
        </Card>
      ) : null}

      {showQuestion && (
        <Card data-testid="message-question">
          <Card.Header><Card.Title>{message.question!.prompt || t.question.needsInfo}</Card.Title></Card.Header>
          <Card.Footer className="flex items-end gap-2">
            <TextArea
              aria-label={t.question.yourAnswer}
              className="flex-1"
              rows={1}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <Button
              isDisabled={!answer.trim() || !onAnswer}
              onPress={() => { if (answer.trim()) { onAnswer?.(answer.trim()); setAnswer('') } }}
            >
              {t.question.answer}
            </Button>
          </Card.Footer>
        </Card>
      )}
    </div>
  )
}
