import { useEffect, useRef, useState } from 'react'
import { Modal, Button, TextField, Input, Label, FieldError } from '@heroui/react'

interface RenameModalProps {
  isOpen: boolean
  currentName: string
  entityLabel: string
  onClose: () => void
  onSave: (newName: string) => Promise<void>
}

export function RenameModal({ isOpen, currentName, entityLabel, onClose, onSave }: RenameModalProps) {
  const [value, setValue] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(currentName)
      setError(null)
      setSaving(false)
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isOpen, currentName])

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Name cannot be empty'); return }
    if (trimmed === currentName) { onClose(); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void handleSave() }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Rename {entityLabel}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField
              value={value}
              onChange={setValue}
              isInvalid={Boolean(error)}
              isDisabled={saving}
              autoFocus
            >
              <Label>Name</Label>
              <Input
                ref={inputRef}
                onKeyDown={handleKeyDown}
              />
              <FieldError>{error}</FieldError>
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="tertiary" onPress={onClose} isDisabled={saving}>Cancel</Button>
            <Button size="sm" variant="primary" onPress={() => void handleSave()} isDisabled={!value.trim() || saving}>Save</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
