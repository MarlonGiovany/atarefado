import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Card, Member } from '../../lib/types'
import { toDateInput } from '../../lib/dates'
import { errorMessage } from '../../lib/api'
import { Modal } from '../Modal'
import { Button, ErrorText, Input, Label } from '../ui'

export type CardChanges = {
  title: string
  description: string
  dueDate: string | null
  assigneeId: string | null
}

type CardModalProps = {
  card: Card
  columnTitle: string
  members: Member[]
  onSave: (cardId: string, changes: CardChanges) => Promise<void>
  onDelete: (cardId: string) => Promise<void>
  onClose: () => void
}

export function CardModal({ card, columnTitle, members, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [dueDate, setDueDate] = useState(toDateInput(card.dueDate))
  const [assigneeId, setAssigneeId] = useState(card.assigneeId ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    run(() =>
      onSave(card.id, {
        title: title.trim(),
        description,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
      }),
    )
  }

  function handleDelete() {
    if (confirm(`Excluir "${card.title}"? Essa ação não pode ser desfeita.`)) {
      run(() => onDelete(card.id))
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
            <Label htmlFor="card-due">Prazo</Label>
            <Input
              id="card-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
          <Button type="button" variant="danger" onClick={handleDelete} disabled={busy}>
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
