import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api, errorMessage } from '../lib/api'
import type { Board, Card, Column, Member } from '../lib/types'
import { KanbanBoard } from '../components/board/KanbanBoard'
import { CardModal } from '../components/board/CardModal'
import type { CardChanges } from '../components/board/CardModal'
import { MembersModal } from '../components/board/MembersModal'
import { Avatar, Button, ErrorText, Input, Spinner } from '../components/ui'

export function BoardPage() {
  const { boardId } = useParams() as { boardId: string }
  const { user } = useAuth()
  const navigate = useNavigate()

  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [error, setError] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')

  const fetchBoard = useCallback(
    () =>
      api<{ board: Board }>(`/boards/${boardId}`).then(
        ({ board }) => {
          setBoard(board)
          setColumns(board.columns)
          setError('')
        },
        (err) => setError(errorMessage(err)),
      ),
    [boardId],
  )

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  /** Runs a mutation; on failure shows the error and resyncs with the server. */
  async function mutate(action: () => Promise<void>) {
    try {
      await action()
    } catch (err) {
      await fetchBoard()
      setError(errorMessage(err))
    }
  }

  const replaceCard = (card: Card) =>
    setColumns((cols) =>
      cols.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? card : c)),
      })),
    )

  // --- Columns ---

  const addColumn = (title: string) =>
    mutate(async () => {
      const { column } = await api<{ column: Column }>(`/boards/${boardId}/columns`, 'POST', { title })
      setColumns((cols) => [...cols, column])
    })

  const renameColumn = (columnId: string, title: string) =>
    mutate(async () => {
      setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, title } : c)))
      await api(`/columns/${columnId}`, 'PATCH', { title })
    })

  const deleteColumn = (column: Column) => {
    const warning = column.cards.length
      ? `Delete "${column.title}" and its ${column.cards.length} card(s)?`
      : `Delete "${column.title}"?`
    if (!confirm(warning)) return
    mutate(async () => {
      setColumns((cols) => cols.filter((c) => c.id !== column.id))
      await api(`/columns/${column.id}`, 'DELETE')
    })
  }

  // --- Cards ---

  const addCard = (columnId: string, title: string) =>
    mutate(async () => {
      const { card } = await api<{ card: Card }>(`/columns/${columnId}/cards`, 'POST', { title })
      setColumns((cols) =>
        cols.map((col) => (col.id === columnId ? { ...col, cards: [...col.cards, card] } : col)),
      )
    })

  const moveCard = (cardId: string, columnId: string, position: number) =>
    mutate(async () => {
      await api(`/cards/${cardId}/move`, 'POST', { columnId, position })
    })

  // Errors here are shown inside the modal, so they're not wrapped in mutate()
  async function saveCard(cardId: string, changes: CardChanges) {
    const { card } = await api<{ card: Card }>(`/cards/${cardId}`, 'PATCH', changes)
    replaceCard(card)
  }

  async function deleteCard(cardId: string) {
    await api(`/cards/${cardId}`, 'DELETE')
    setColumns((cols) => cols.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })))
  }

  // --- Board & members ---

  const saveTitle = () => {
    setEditingTitle(false)
    const value = title.trim()
    if (!board || !value || value === board.title) return
    mutate(async () => {
      setBoard({ ...board, title: value })
      await api(`/boards/${boardId}`, 'PATCH', { title: value })
    })
  }

  const deleteBoard = () => {
    if (!board || !confirm(`Delete the board "${board.title}" and everything in it?`)) return
    mutate(async () => {
      await api(`/boards/${boardId}`, 'DELETE')
      navigate('/')
    })
  }

  async function inviteMember(email: string) {
    const { member } = await api<{ member: Member }>(`/boards/${boardId}/members`, 'POST', { email })
    setBoard((b) => (b ? { ...b, members: [...b.members, member] } : b))
  }

  async function removeMember(member: Member) {
    await api(`/boards/${boardId}/members/${member.userId}`, 'DELETE')
    if (member.userId === user?.id) {
      navigate('/')
      return
    }
    setBoard((b) => (b ? { ...b, members: b.members.filter((m) => m.userId !== member.userId) } : b))
    // Their cards were unassigned on the server
    setColumns((cols) =>
      cols.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c.assigneeId === member.userId ? { ...c, assigneeId: null, assignee: null } : c,
        ),
      })),
    )
  }

  if (!board) {
    return error ? (
      <div className="mx-auto mt-16 max-w-md px-4 text-center">
        <ErrorText>{error}</ErrorText>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-600">
          ← Back to boards
        </Link>
      </div>
    ) : (
      <div className="mt-16 flex justify-center">
        <Spinner />
      </div>
    )
  }

  const isOwner = board.members.some((m) => m.userId === user?.id && m.role === 'OWNER')
  const openCard = columns.flatMap((c) => c.cards).find((c) => c.id === openCardId)
  const openCardColumn = columns.find((c) => c.id === openCard?.columnId)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Back to boards"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          {editingTitle ? (
            <Input
              autoFocus
              aria-label="Board title"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              className="text-lg font-bold sm:w-80"
            />
          ) : (
            <h1>
              <button
                type="button"
                title="Rename board"
                onClick={() => {
                  setTitle(board.title)
                  setEditingTitle(true)
                }}
                className="truncate rounded-md px-1 text-xl font-bold text-slate-900 hover:bg-slate-200/60"
              >
                {board.title}
              </button>
            </h1>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            className="flex -space-x-2 rounded-full"
            aria-label="Show members"
          >
            {board.members.slice(0, 5).map((m) => (
              <Avatar key={m.userId} name={m.user.name} id={m.userId} />
            ))}
          </button>
          <Button variant="secondary" onClick={() => setShowMembers(true)}>
            {isOwner ? 'Share' : 'Members'}
          </Button>
          {isOwner && (
            <Button variant="danger" onClick={deleteBoard}>
              Delete board
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 pb-3 sm:px-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="flex-1">
        <KanbanBoard
          columns={columns}
          setColumns={setColumns}
          onMoveCard={moveCard}
          onOpenCard={(card) => setOpenCardId(card.id)}
          onAddCard={addCard}
          onAddColumn={addColumn}
          onRenameColumn={renameColumn}
          onDeleteColumn={deleteColumn}
        />
      </div>

      {openCard && (
        <CardModal
          card={openCard}
          columnTitle={openCardColumn?.title ?? ''}
          members={board.members}
          onSave={saveCard}
          onDelete={deleteCard}
          onClose={() => setOpenCardId(null)}
        />
      )}

      {showMembers && user && (
        <MembersModal
          members={board.members}
          currentUserId={user.id}
          onInvite={inviteMember}
          onRemove={removeMember}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
