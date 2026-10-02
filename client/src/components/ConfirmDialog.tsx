import { useState } from 'react'
import { errorMessage } from '../lib/api'
import { Modal } from './Modal'
import { Button, ErrorText } from './ui'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

/**
 * In-app replacement for window.confirm(), which some browsers and embedded
 * webviews block silently (it returns false without showing anything).
 * "Cancelar" comes first so it gets the initial focus: Enter never deletes by accident.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="dangerSolid" onClick={handleConfirm} disabled={busy}>
          {busy ? 'Aguarde…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
