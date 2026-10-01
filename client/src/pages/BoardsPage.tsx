import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage } from '../lib/api'
import type { BoardSummary } from '../lib/types'
import { Button, ErrorText, Input, Spinner } from '../components/ui'

const accents = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-400',
  'from-rose-500 to-pink-400',
]

export function BoardsPage() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api<{ boards: BoardSummary[] }>('/boards')
      .then(({ boards }) => setBoards(boards))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  async function createBoard(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError('')
    try {
      const { board } = await api<{ board: BoardSummary }>('/boards', 'POST', { title })
      navigate(`/boards/${board.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seus quadros</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quadros que você criou ou para os quais foi convidado.
          </p>
        </div>
        <form onSubmit={createBoard} className="flex w-full gap-2 sm:w-auto">
          <Input
            aria-label="Nome do novo quadro"
            placeholder="Nome do novo quadro"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            className="sm:w-64"
          />
          <Button type="submit" disabled={creating || !title.trim()} className="shrink-0">
            Criar quadro
          </Button>
        </form>
      </div>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>

      {boards === null && !error ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : boards?.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-16 text-center">
          <h2 className="font-semibold text-slate-900">Nenhum quadro ainda</h2>
          <p className="mt-1 text-sm text-slate-500">
            Crie seu primeiro quadro acima para começar a organizar as tarefas.
          </p>
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
