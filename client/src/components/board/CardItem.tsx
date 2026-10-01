import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../../lib/types'
import { dueStatus, formatDue } from '../../lib/dates'
import { Avatar } from '../ui'

const dueStyles = {
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  today: 'bg-amber-50 text-amber-700 ring-amber-200',
  upcoming: 'bg-slate-50 text-slate-600 ring-slate-200',
}

/** Visual card body, shared by the sortable item and the drag overlay. */
export function CardContent({ card, dragging = false }: { card: Card; dragging?: boolean }) {
  const status = card.dueDate ? dueStatus(card.dueDate) : null
  return (
    <div
      className={`rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 ${
        dragging ? 'rotate-2 shadow-lg ring-indigo-300' : 'hover:ring-indigo-300'
      }`}
    >
      <p className="text-sm font-medium break-words text-slate-800">{card.title}</p>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>
      )}
      {(card.dueDate || card.assignee) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {card.dueDate && status ? (
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ${dueStyles[status]}`}
            >
              {status === 'overdue' ? 'Atrasado · ' : status === 'today' ? 'Hoje · ' : ''}
              {formatDue(card.dueDate)}
            </span>
          ) : (
            <span />
          )}
          {card.assignee && <Avatar name={card.assignee.name} id={card.assignee.id} size="sm" />}
        </div>
      )}
    </div>
  )
}

export function CardItem({ card, onOpen }: { card: Card; onOpen: (card: Card) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : ''}
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
    </li>
  )
}
