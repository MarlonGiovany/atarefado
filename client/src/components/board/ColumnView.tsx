import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Card, Column } from '../../lib/types'
import { CardItem } from './CardItem'
import { Button, Input } from '../ui'

type ColumnViewProps = {
  column: Column
  onOpenCard: (card: Card) => void
  onAddCard: (columnId: string, title: string) => Promise<void>
  onRename: (columnId: string, title: string) => void
  onDelete: (column: Column) => void
}

export function ColumnView({ column, onOpenCard, onAddCard, onRename, onDelete }: ColumnViewProps) {
  // The column body is a drop target too, so cards can be dropped into empty columns
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } })
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
            aria-label="Column title"
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
            title="Rename column"
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
          aria-label={`Delete column ${column.title}`}
          title="Delete column"
          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
              clipRule="evenodd"
            />
          </svg>
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
            <CardItem key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </ul>
      </SortableContext>

      <div className="px-3 pb-3">
        {adding ? (
          <form onSubmit={submitCard} className="space-y-2">
            <Input
              autoFocus
              aria-label="Card title"
              placeholder="What needs to be done?"
              value={newTitle}
              maxLength={200}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!newTitle.trim()}>
                Add card
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
          >
            + Add a card
          </button>
        )}
      </div>
    </section>
  )
}
