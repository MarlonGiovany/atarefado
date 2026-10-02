import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Card, Column } from '../../lib/types'
import { CardItem } from './CardItem'
import { Button, Input, TrashIcon } from '../ui'

type ColumnViewProps = {
  column: Column
  onOpenCard: (card: Card) => void
  onDeleteCard: (card: Card) => void
  onAddCard: (columnId: string, title: string) => Promise<void>
  onRename: (columnId: string, title: string) => void
  onDelete: (column: Column) => void
}

export function ColumnView({
  column,
  onOpenCard,
  onDeleteCard,
  onAddCard,
  onRename,
  onDelete,
}: ColumnViewProps) {
  // The column body is a drop target too, so cards can be dropped into empty columns
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', cardCount: column.cards.length },
  })
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(column.title)

  async function submitCard(e: FormEvent) {
    e.preventDefault()
    const value = newTitle.trim()
    if (!value) return
    setNewTitle('')
    await onAddCard(column.id, value)
  }

  function submitTitle() {
    setEditingTitle(false)
    const value = title.trim()
    if (value && value !== column.title) onRename(column.id, value)
    else setTitle(column.title)
  }

  return (
    <section className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-100 ring-1 ring-slate-200/70">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        {editingTitle ? (
          <Input
            autoFocus
            aria-label="Nome da coluna"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTitle()
              if (e.key === 'Escape') {
                setTitle(column.title)
                setEditingTitle(false)
              }
            }}
            className="py-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitle(column.title)
              setEditingTitle(true)
            }}
            title="Renomear coluna"
            className="min-w-0 flex-1 truncate rounded px-1 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200/70"
          >
            {column.title}
          </button>
        )}
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {column.cards.length}
        </span>
        <button
          type="button"
          onClick={() => onDelete(column)}
          aria-label={`Excluir coluna ${column.title}`}
          title="Excluir coluna"
          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
        >
          <TrashIcon />
        </button>
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2 transition-colors ${
            isOver ? 'rounded-lg bg-indigo-50/70' : ''
          }`}
        >
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} onOpen={onOpenCard} onDelete={onDeleteCard} />
          ))}
        </ul>
      </SortableContext>

      <div className="px-3 pb-3">
        {adding ? (
          <form onSubmit={submitCard} className="space-y-2">
            <Input
              autoFocus
              aria-label="Título do card"
              placeholder="O que precisa ser feito?"
              value={newTitle}
              maxLength={200}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!newTitle.trim()}>
                Adicionar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
          >
            + Adicionar card
          </button>
        )}
      </div>
    </section>
  )
}
