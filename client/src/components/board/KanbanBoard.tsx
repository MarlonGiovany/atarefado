import { useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Card, Column } from '../../lib/types'
import { positionBetween } from '../../lib/position'
import { ColumnView } from './ColumnView'
import { boardKeyboardCoordinates } from './keyboardCoordinates'
import { CardContent } from './CardItem'
import { Button, Input } from '../ui'

type KanbanBoardProps = {
  columns: Column[]
  setColumns: Dispatch<SetStateAction<Column[]>>
  onMoveCard: (cardId: string, columnId: string, position: number) => void
  onOpenCard: (card: Card) => void
  onDeleteCard: (card: Card) => void
  onAddCard: (columnId: string, title: string) => Promise<void>
  onAddColumn: (title: string) => Promise<void>
  onRenameColumn: (columnId: string, title: string) => void
  onDeleteColumn: (column: Column) => void
}

function findColumnId(columns: Column[], id: UniqueIdentifier) {
  if (columns.some((col) => col.id === id)) return id as string
  return columns.find((col) => col.cards.some((card) => card.id === id))?.id
}

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Para abrir o card, pressione Enter. Para mover, pressione Espaço, use as setas ' +
    'e pressione Espaço de novo para soltar. Esc cancela o movimento.',
}

/** Screen reader messages in Portuguese, naming the card, column and position instead of ids. */
function buildAnnouncements(columns: Column[]): Announcements {
  const cardTitle = (id: UniqueIdentifier) =>
    columns.flatMap((col) => col.cards).find((c) => c.id === id)?.title ?? 'card'
  // "coluna "A fazer", posição 2 de 3" for the spot the card is over
  const place = (overId: UniqueIdentifier) => {
    const column = columns.find((col) => col.id === findColumnId(columns, overId))
    if (!column) return 'fora das colunas'
    const index = column.cards.findIndex((c) => c.id === overId)
    const total = column.cards.length
    return index >= 0
      ? `coluna "${column.title}", posição ${index + 1} de ${total}`
      : `fim da coluna "${column.title}"`
  }
  return {
    onDragStart: ({ active }) =>
      `Card "${cardTitle(active.id)}" selecionado. Use as setas para mover e Espaço para soltar.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Card "${cardTitle(active.id)}" na ${place(over.id)}.`
        : `Card "${cardTitle(active.id)}" fora das colunas.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Card "${cardTitle(active.id)}" solto na ${place(over.id)}.`
        : `Card "${cardTitle(active.id)}" voltou ao lugar.`,
    onDragCancel: ({ active }) =>
      `Movimento cancelado. Card "${cardTitle(active.id)}" voltou ao lugar.`,
  }
}

export function KanbanBoard({
  columns,
  setColumns,
  onMoveCard,
  onOpenCard,
  onDeleteCard,
  onAddCard,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  // State before the drag started, to restore on cancel and to detect real changes
  const snapshot = useRef<Column[]>([])
  const [newColumn, setNewColumn] = useState('')

  const sensors = useSensors(
    // A small distance lets a plain click open the card instead of starting a drag
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // On touch screens a drag needs press-and-hold, so swiping still scrolls the page
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    // Only Space picks a card up, so Enter keeps opening it
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    snapshot.current = columns
    const card = columns.flatMap((col) => col.cards).find((c) => c.id === active.id)
    setActiveCard(card ?? null)
  }

  // Moving between columns happens live while dragging so the target column makes room
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const fromId = findColumnId(columns, active.id)
    const toId = findColumnId(columns, over.id)
    if (!fromId || !toId || fromId === toId) return

    setColumns((prev) => {
      const card = prev.find((c) => c.id === fromId)?.cards.find((c) => c.id === active.id)
      const target = prev.find((c) => c.id === toId)
      if (!card || !target) return prev
      const overIndex = target.cards.findIndex((c) => c.id === over.id)
      const insertAt = overIndex >= 0 ? overIndex : target.cards.length

      return prev.map((col) => {
        if (col.id === fromId) {
          return { ...col, cards: col.cards.filter((c) => c.id !== active.id) }
        }
        if (col.id === toId) {
          const cards = [...col.cards]
          cards.splice(insertAt, 0, { ...card, columnId: toId })
          return { ...col, cards }
        }
        return col
      })
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)
    const columnId = findColumnId(columns, active.id)
    if (!over || !columnId) {
      setColumns(snapshot.current)
      return
    }

    const column = columns.find((c) => c.id === columnId)!
    const oldIndex = column.cards.findIndex((c) => c.id === active.id)
    const overIndex = column.cards.findIndex((c) => c.id === over.id)
    const cards =
      overIndex >= 0 && overIndex !== oldIndex
        ? arrayMove(column.cards, oldIndex, overIndex)
        : column.cards
    const index = cards.findIndex((c) => c.id === active.id)
    const original = snapshot.current
      .flatMap((col) => col.cards)
      .find((c) => c.id === active.id)!

    const sameColumn = original.columnId === columnId
    const sameSpot =
      sameColumn &&
      snapshot.current.find((c) => c.id === columnId)!.cards.findIndex((c) => c.id === active.id) ===
        index
    if (sameSpot) {
      setColumns(snapshot.current)
      return
    }

    const position = positionBetween(cards[index - 1]?.position, cards[index + 1]?.position)
    const moved = { ...cards[index], columnId, position }
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, cards: cards.map((c) => (c.id === moved.id ? moved : c)) }
          : col,
      ),
    )
    onMoveCard(moved.id, columnId, position)
  }

  async function submitColumn(e: FormEvent) {
    e.preventDefault()
    const value = newColumn.trim()
    if (!value) return
    setNewColumn('')
    await onAddColumn(value)
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: buildAnnouncements(columns), screenReaderInstructions }}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveCard(null)
        setColumns(snapshot.current)
      }}
    >
      <div className="flex h-full items-start gap-4 overflow-x-auto px-4 pb-6 sm:px-6">
        {columns.map((column) => (
          <ColumnView
            key={column.id}
            column={column}
            onOpenCard={onOpenCard}
            onDeleteCard={onDeleteCard}
            onAddCard={onAddCard}
            onRename={onRenameColumn}
            onDelete={onDeleteColumn}
          />
        ))}

        <form
          onSubmit={submitColumn}
          className="w-72 shrink-0 space-y-2 rounded-xl border-2 border-dashed border-slate-200 p-3"
        >
          <Input
            aria-label="Nome da nova coluna"
            placeholder="+ Adicionar coluna"
            value={newColumn}
            maxLength={100}
            onChange={(e) => setNewColumn(e.target.value)}
            className="bg-transparent ring-0 focus:bg-white"
          />
          {newColumn.trim() && (
            <Button type="submit" className="w-full">
              Adicionar coluna
            </Button>
          )}
        </form>
      </div>

      <DragOverlay>{activeCard && <CardContent card={activeCard} dragging />}</DragOverlay>
    </DndContext>
  )
}
