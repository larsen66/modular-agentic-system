// Transcript screen view (design: docs/design/chat/screens/message-list.md).
// Scroll host + rows + autoscroll-when-near-bottom. HeroUI v3 only; no custom CSS.

import { useEffect, useRef } from 'react'
import { ScrollShadow } from '@heroui/react'
import { MessageRow } from '../../components/message-list/MessageRow'
import { useChatStrings } from '../../i18n'
import type { TranscriptProps } from '../../types'

export function Transcript({ messages, onAnswer, onPermissionRespond, onTopUp, headerSlot, footerSlot }: TranscriptProps) {
  const t = useChatStrings()
  const endRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const lastLen = messages.length
  const lastText = messages.at(-1)?.text ?? ''

  // Autoscroll to the latest only when the user is already near the bottom (no scroll-hijack).
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const nearBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 120
    if (nearBottom) endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [lastLen, lastText])

  return (
    <ScrollShadow ref={hostRef} className="flex-1 min-h-0" data-testid="chat-transcript">
      <div className="flex flex-col gap-4 p-4">
        {headerSlot}
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground" data-testid="transcript-empty">
            {t.transcript.empty}
          </div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} onAnswer={onAnswer as ((answer: string) => void) | undefined} onPermissionRespond={onPermissionRespond} onTopUp={onTopUp} />)
        )}
        {footerSlot}
        <div ref={endRef} />
      </div>
    </ScrollShadow>
  )
}
