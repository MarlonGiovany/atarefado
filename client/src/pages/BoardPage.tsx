import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api, errorMessage } from '../lib/api'
import { dayOf, formatShortDay, isDayKey, todayKey, weekOf } from '../lib/dates'
import type { Board, Card, Column, Member } from '../lib/types'
import { KanbanBoard } from '../components/board/KanbanBoard'
import { CardModal } from '../components/board/CardModal'
import type { CardChanges } from '../components/board/CardModal'
import { DateBar } from '../components/board/DateBar'
import { MembersModal } from '../components/board/MembersModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Toast } from '../components/Toast'
import type { Notice } from '../components/Toast'
import { Avatar, Button, ErrorText, Input, Spinner } from '../components/ui'

type ConfirmRequest = {
  title: string
  message: string
  confirmLabel: string
  action: () => Promise<void>
}

export function BoardPage() {
  const { boardId } = useParams() as { boardId: string }
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // The selected day lives in the URL (?dia=YYYY-MM-DD) so reloads and shared links keep it
  const today = todayKey()
  const dayParam = searchParams.get('dia')
  const day = isDayKey(dayParam) ? dayParam : today
  const week = weekOf(day)
  const weekStart = week[0]
  const weekEnd = week[6]

  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  // Day the loaded cards belong to; differs from `day` while another day is loading
  const [loadedDay, setLoadedDay] = useState<string | null>(null)
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({})
  const [countsVersion, setCountsVersion] = useState(0)
  const [error, setError] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')

  useEffect(() => {
    let active = true
    api<{ board: Board }>(`/boards/${boardId}?date=${day}`).then(
      ({ board }) => {
        if (!active) return
        setBoard(board)
        setColumns(board.columns)
        setLoadedDay(day)
        setError('')
      },
      (err) => {
        if (active) setError(errorMessage(err))
      },
    )
    return () => {
      active = false
    }
  }, [boardId, day])

  useEffect(() => {
    let active = true
    api<{ days: Record<string, number> }>(
      `/boards/${boardId}/days?from=${weekStart}&to=${weekEnd}`,
    ).then(
      ({ days }) => {
        if (active) setWeekCounts(days)
      },
      () => {
        /* counts are only a hint; the board still works without them */
      },
    )
    return () => {
      active = false
    }
  }, [boardId, weekStart, weekEnd, countsVersion])

  async function reload() {
    try {
      const { board } = await api<{ board: Board }>(`/boards/${boardId}?date=${day}`)
      setBoard(board)
      setColumns(board.columns)
      setLoadedDay(day)
    } catch {
      /* the original error is already on screen */
    }
  }

  /** Runs a mutation; on failure shows the error and resyncs with the server. */
  async function mutate(action: () => Promise<void>) {
    try {
      await action()
    } catch (err) {
      await reload()
      setError(errorMessage(err))
    }
  }

  function selectDay(next: string) {
    setOpenCardId(null)
    setSearchParams(next === today ? {} : { dia: next }, { replace: true })
  }

  const replaceCard = (card: Card) =>
    setColumns((cols) =>
      cols.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? card : c)),
      })),
    )

  const removeCard = (cardId: string) =>
    setColumns((cols) =>
      cols.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
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

  const requestDeleteColumn = (column: Column) =>
    setConfirmRequest({
      title: 'Excluir coluna',
      message: `A coluna "${column.title}" e todos os cards dela, de todas as datas, serão excluídos permanentemente.`,
      confirmLabel: 'Excluir coluna',
      action: async () => {
        await api(`/columns/${column.id}`, 'DELETE')
        setColumns((cols) => cols.filter((c) => c.id !== column.id))
        setCountsVersion((v) => v + 1)
      },
    })

  // --- Cards ---

  const addCard = (columnId: string, title: string) =>
    mutate(async () => {
      const { card } = await api<{ card: Card }>(`/columns/${columnId}/cards`, 'POST', {
        title,
        date: day,
      })
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
    const cardDay = dayOf(card.date)
    if (cardDay === day) {
      replaceCard(card)
      return
    }
    // Rescheduled to another day: it leaves this view
    removeCard(card.id)
    setCountsVersion((v) => v + 1)
    setNotice({
      id: Date.now(),
      // formatShortDay already ends with the month abbreviation's dot ("3 de out.")
      message: `Card movido para ${formatShortDay(cardDay)}`,
      action: { label: 'Ver dia', onClick: () => selectDay(cardDay) },
    })
  }

  const requestDeleteCard = (card: Card) =>
    setConfirmRequest({
      title: 'Excluir card',
      message: `O card "${card.title}" será excluído permanentemente. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir card',
      action: async () => {
        await api(`/cards/${card.id}`, 'DELETE')
        removeCard(card.id)
        setOpenCardId((id) => (id === card.id ? null : id))
        setNotice({ id: Date.now(), message: 'Card excluído.' })
      },
    })

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

  const requestDeleteBoard = () => {
    if (!board) return
    setConfirmRequest({
      title: 'Excluir quadro',
      message: `O quadro "${board.title}" e todo o seu conteúdo serão excluídos permanentemente.`,
      confirmLabel: 'Excluir quadro',
      action: async () => {
        await api(`/boards/${boardId}`, 'DELETE')
        navigate('/')
      },
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
          ← Voltar aos quadros
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
  const isLoadingDay = loadedDay !== day
  const dayTotal = columns.reduce((sum, col) => sum + col.cards.length, 0)
  // The selected day's count comes from what's on screen, so it updates instantly
  const counts = isLoadingDay ? weekCounts : { ...weekCounts, [day]: dayTotal }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Voltar aos quadros"
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
              aria-label="Título do quadro"
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
            <h1 className="min-w-0">
              <button
                type="button"
                title="Renomear quadro"
                onClick={() => {
                  setTitle(board.title)
                  setEditingTitle(true)
                }}
                className="max-w-full truncate rounded-md px-1 text-xl font-bold text-slate-900 hover:bg-slate-200/60"
              >
                {board.title}
              </button>
            </h1>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            className="flex -space-x-2 rounded-full"
            aria-label="Ver membros"
          >
            {board.members.slice(0, 5).map((m) => (
              <Avatar key={m.userId} name={m.user.name} id={m.userId} />
            ))}
          </button>
          <Button variant="secondary" onClick={() => setShowMembers(true)}>
            {isOwner ? 'Compartilhar' : 'Membros'}
          </Button>
          {isOwner && (
            <Button variant="danger" onClick={requestDeleteBoard}>
              Excluir quadro
            </Button>
          )}
        </div>
      </div>

      <DateBar day={day} today={today} counts={counts} onChange={selectDay} />

      {error && (
        <div className="px-4 pb-3 sm:px-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!isLoadingDay && dayTotal === 0 && (
        <p className="mx-4 mb-3 text-sm text-slate-500 sm:mx-6">
          Nenhuma tarefa para este dia. Use “+ Adicionar card” em uma coluna para criar uma.
        </p>
      )}

      <div
        aria-busy={isLoadingDay}
        className={`flex-1 transition-opacity ${isLoadingDay ? 'pointer-events-none opacity-50' : ''}`}
      >
        <KanbanBoard
          columns={columns}
          setColumns={setColumns}
          onMoveCard={moveCard}
          onOpenCard={(card) => setOpenCardId(card.id)}
          onDeleteCard={requestDeleteCard}
          onAddCard={addCard}
          onAddColumn={addColumn}
          onRenameColumn={renameColumn}
          onDeleteColumn={requestDeleteColumn}
        />
      </div>

      {openCard && (
        <CardModal
          card={openCard}
          columnTitle={openCardColumn?.title ?? ''}
          members={board.members}
          onSave={saveCard}
          onRequestDelete={requestDeleteCard}
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

      {/* Rendered last so it stacks above the card modal */}
      {confirmRequest && (
        <ConfirmDialog
          title={confirmRequest.title}
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          onConfirm={confirmRequest.action}
          onClose={() => setConfirmRequest(null)}
        />
      )}

      {notice && <Toast key={notice.id} notice={notice} onClose={() => setNotice(null)} />}
    </div>
  )
}
