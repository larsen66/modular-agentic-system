import { useState } from 'react'
import { Modal, Button } from '@heroui/react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  name: string
  entityLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({ isOpen, name, entityLabel, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open && !deleting) onClose() }}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Delete {entityLabel}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm">Delete <strong>{name}</strong>? This cannot be undone.</p>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="tertiary" onPress={onClose} isDisabled={deleting}>Cancel</Button>
            <Button size="sm" variant="danger" onPress={() => void handleConfirm()} isDisabled={deleting}>Delete</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
