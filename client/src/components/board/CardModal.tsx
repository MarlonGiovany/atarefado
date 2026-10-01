import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Card, Member } from '../../lib/types'
import { dayOf, isDayKey } from '../../lib/dates'
import { errorMessage } from '../../lib/api'
import { Modal } from '../Modal'
import { Button, ErrorText, Input, Label, TrashIcon } from '../ui'

export type CardChanges = {
  title: string
  description: string
  /** YYYY-MM-DD; changing it moves the card to another day */
  date: string
  assigneeId: string | null
}

type CardModalProps = {
  card: Card
  columnTitle: string
  members: Member[]
  onSave: (cardId: string, changes: CardChanges) => Promise<void>
  /** Asks for confirmation before deleting; see ConfirmDialog */
  onRequestDelete: (card: Card) => void
  onClose: () => void
}

export function CardModal({
  card,
  columnTitle,
  members,
  onSave,
  onRequestDelete,
  onClose,
}: CardModalProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [date, setDate] = useState(dayOf(card.date))
  const [assigneeId, setAssigneeId] = useState(card.assigneeId ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isDayKey(date)) {
      setError('Escolha uma data válida.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(card.id, {
        title: title.trim(),
        description,
        date,
        assigneeId: assigneeId || null,
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Editar card" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          Na coluna <span className="font-medium text-slate-700">{columnTitle}</span>
        </p>
        <div>
          <Label htmlFor="card-title">Título</Label>
          <Input
            id="card-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="card-description">Descrição</Label>
          <textarea
            id="card-description"
            rows={5}
            maxLength={5000}
            placeholder="Adicione mais detalhes…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-y rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="card-date">Data</Label>
            <Input
              id="card-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="card-assignee">Responsável</Label>
            <select
              id="card-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="">Ninguém</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="danger"
            onClick={() => onRequestDelete(card)}
            disabled={busy}
          >
            <TrashIcon />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
