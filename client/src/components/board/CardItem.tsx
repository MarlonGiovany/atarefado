import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../../lib/types'
import { Avatar, TrashIcon } from '../ui'

/** Visual card body, shared by the sortable item and the drag overlay. */
export function CardContent({ card, dragging = false }: { card: Card; dragging?: boolean }) {
  return (
    <div
      className={`rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 ${
        dragging ? 'rotate-2 shadow-lg ring-indigo-300' : 'hover:ring-indigo-300'
      }`}
    >
      {/* Right padding leaves room for the delete button */}
      <p className="pr-6 text-sm font-medium break-words text-slate-800">{card.title}</p>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>
      )}
      {card.assignee && (
        <div className="mt-3 flex justify-end">
          <Avatar name={card.assignee.name} id={card.assignee.id} size="sm" />
        </div>
      )}
    </div>
  )
}

type CardItemProps = {
  card: Card
  onOpen: (card: Card) => void
  onDelete: (card: Card) => void
}

export function CardItem({ card, onOpen, onDelete }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        className="block w-full cursor-grab rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600 active:cursor-grabbing"
        onClick={() => onOpen(card)}
        {...attributes}
        {...listeners}
      >
        <CardContent card={card} />
      </button>
      {/* Sibling of the drag handle, so pressing it never starts a drag */}
      <button
        type="button"
        onClick={() => onDelete(card)}
        aria-label={`Excluir card ${card.title}`}
        title="Excluir card"
        className="absolute top-2 right-2 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-red-600 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <TrashIcon />
      </button>
    </li>
  )
}
