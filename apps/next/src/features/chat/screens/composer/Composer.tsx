// Composer screen view (design: docs/design/chat/screens/composer.md, Variant A).
// HeroUI v3 only — no custom CSS; structural flex/gap utilities only. Presentational: the pane
// wires data via useChatRun. Parity affordances (attach/voice/visual-edit) render only when their
// handler prop is provided.

import { useRef, type KeyboardEvent } from 'react'
import { Button, Chip, Separator, Spinner, TextArea, Tooltip } from '@heroui/react'
import { Mic, MousePointerClick, Paperclip, Send, Square, X } from 'lucide-react'
import { useChatStrings } from '../../i18n'
import type { ComposerProps } from '../../types'

export function Composer(props: ComposerProps) {
  const t = useChatStrings()
  const {
    value, onChange, onSend, onStop, isStreaming = false, disabled = false,
    placeholder = t.composer.placeholder,
    provisioningHint, onAttachFiles, attachments = [], onRemoveAttachment,
    onToggleVoice, isRecording = false, onToggleElementPicker, pickerActive = false, selectorSlot,
  } = props

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSend = !disabled && value.trim().length > 0

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape' && isStreaming) { e.preventDefault(); onStop?.(); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return // Enter is swallowed while a run streams (use Stop)
      if (canSend) onSend()
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3" data-testid="chat-composer">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="composer-attachments">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1">
              <Chip>{a.name}</Chip>
              {onRemoveAttachment && (
                <Button isIconOnly variant="ghost" aria-label={`${t.composer.removeAttachment} ${a.name}`} onPress={() => onRemoveAttachment(a.id)}>
                  <X className="size-3" />
                </Button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1">
          {onAttachFiles && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                data-testid="composer-file-input"
                onChange={(e) => { onAttachFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
              />
              <Tooltip>
                <Tooltip.Trigger>
                  <Button isIconOnly variant="ghost" aria-label={t.composer.attach} onPress={() => fileInputRef.current?.click()}>
                    <Paperclip className="size-4" />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>{t.composer.attach}</Tooltip.Content>
              </Tooltip>
            </>
          )}
          {onToggleElementPicker && (
            <Tooltip>
              <Tooltip.Trigger>
                <Button isIconOnly variant={pickerActive ? 'secondary' : 'ghost'} aria-label={t.composer.visualEditLabel} aria-pressed={pickerActive} onPress={onToggleElementPicker}>
                  <MousePointerClick className="size-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{t.composer.visualEdit}</Tooltip.Content>
            </Tooltip>
          )}
          {onToggleVoice && (
            <Tooltip>
              <Tooltip.Trigger>
                <Button isIconOnly variant={isRecording ? 'secondary' : 'ghost'} aria-label={t.composer.voice} aria-pressed={isRecording} onPress={onToggleVoice}>
                  <Mic className="size-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{isRecording ? t.composer.stopRecording : t.composer.voice}</Tooltip.Content>
            </Tooltip>
          )}
        </div>

        <TextArea
          aria-label={t.composer.messageLabel}
          className="flex-1"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {isStreaming ? (
          <Button variant="danger-soft" aria-label={t.composer.stopLabel} onPress={() => onStop?.()}>
            <Square className="size-4" /> {t.composer.stop}
          </Button>
        ) : (
          <Button aria-label={t.composer.sendLabel} isDisabled={!canSend} onPress={onSend}>
            <Send className="size-4" /> {t.composer.send}
          </Button>
        )}
      </div>

      {provisioningHint && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="composer-provisioning">
          <Spinner size="sm" /> <span>{provisioningHint}</span>
        </div>
      )}

      {selectorSlot && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">{selectorSlot}</div>
        </>
      )}
    </div>
  )
}
