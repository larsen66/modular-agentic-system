import { useEffect, useRef, useState } from 'react'
import { Modal, Button, TextField, Input, Label, FieldError } from '@heroui/react'

interface CreateAppModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function CreateAppModal({ isOpen, onClose, onCreate }: CreateAppModalProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setError(null)
      setCreating(false)
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('App name cannot be empty'); return }
    setCreating(true)
    setError(null)
    try {
      await onCreate(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create app')
    } finally {
      setCreating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void handleCreate() }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>New app</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField
              value={name}
              onChange={setName}
              isInvalid={Boolean(error)}
              isDisabled={creating}
              autoFocus
            >
              <Label>App name</Label>
              <Input
                ref={inputRef}
                placeholder="My App"
                onKeyDown={handleKeyDown}
              />
              <FieldError>{error}</FieldError>
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="tertiary" onPress={onClose} isDisabled={creating}>Cancel</Button>
            <Button size="sm" variant="primary" onPress={() => void handleCreate()} isDisabled={!name.trim() || creating}>Create</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
