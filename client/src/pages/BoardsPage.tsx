import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage } from '../lib/api'
import type { BoardSummary } from '../lib/types'
import { Button, ErrorText, FieldHint, Input, Spinner } from '../components/ui'

const accents = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-400',
  'from-rose-500 to-pink-400',
]

type CreateBoardFormProps = {
  onCreate: (title: string) => Promise<void>
  /** Larger, centred layout used in the empty state */
  prominent?: boolean
}

/**
 * The button stays enabled: an empty name explains what's missing instead of the
 * button silently doing nothing.
 */
function CreateBoardForm({ onCreate, prominent = false }: CreateBoardFormProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Digite um nome para o quadro antes de criar.')
      inputRef.current?.focus()
      return
    }
    setCreating(true)
    setError('')
    try {
      await onCreate(title.trim())
    } catch (err) {
      setError(errorMessage(err))
      setCreating(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={prominent ? 'mx-auto mt-6 w-full max-w-md text-left' : 'w-full sm:w-auto'}
    >
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          autoFocus={prominent}
          aria-label="Nome do novo quadro"
          placeholder={prominent ? 'Ex.: Estudos, Trabalho, Casa' : 'Nome do novo quadro'}
          value={title}
          maxLength={100}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            if (error) setError('')
          }}
          className={prominent ? '' : 'sm:w-64'}
        />
        <Button type="submit" disabled={creating} className="shrink-0">
          {creating ? 'Criando…' : 'Criar quadro'}
        </Button>
      </div>
      <FieldHint id={errorId}>{error}</FieldHint>
    </form>
  )
}

export function BoardsPage() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ boards: BoardSummary[] }>('/boards')
      .then(({ boards }) => setBoards(boards))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  async function createBoard(title: string) {
    const { board } = await api<{ board: BoardSummary }>('/boards', 'POST', { title })
    navigate(`/boards/${board.id}`)
  }

  const isEmpty = boards?.length === 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seus quadros</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quadros que você criou ou para os quais foi convidado.
          </p>
        </div>
        {/* With no boards yet, the form lives in the empty state below instead */}
        {boards && !isEmpty && <CreateBoardForm onCreate={createBoard} />}
      </div>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>

      {boards === null && !error ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : isEmpty ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-14 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-12 place-items-center rounded-xl bg-indigo-100 text-2xl text-indigo-600"
          >
            +
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Crie seu primeiro quadro aqui</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dê um nome ao quadro e clique em “Criar quadro”. Depois é só adicionar suas tarefas.
          </p>
          <CreateBoardForm onCreate={createBoard} prominent />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards?.map((board, i) => (
            <li key={board.id}>
              <Link
                to={`/boards/${board.id}`}
                className="group block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={`h-20 bg-linear-to-br ${accents[i % accents.length]}`} />
                <div className="p-4">
                  <h2 className="truncate font-semibold text-slate-900 group-hover:text-indigo-600">
                    {board.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {board._count.members} {board._count.members === 1 ? 'membro' : 'membros'}
                    {' · '}
                    criado em {new Date(board.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
