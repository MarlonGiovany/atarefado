import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage } from '../lib/api'
import { boardIdForSlug, rememberBoard } from '../lib/boards'
import { ErrorText, Spinner } from '../components/ui'
import { BoardPage } from './BoardPage'

type Resolved = { slug: string; id: string }

/** /quadros/<slug>: finds the board id for the address, then shows the board. */
export function BoardBySlugPage() {
  const { slug } = useParams() as { slug: string }
  const knownId = boardIdForSlug(slug)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [error, setError] = useState<{ slug: string; message: string } | null>(null)

  useEffect(() => {
    if (knownId) return
    let active = true
    api<{ board: Resolved }>(`/boards/slug/${encodeURIComponent(slug)}`).then(
      ({ board }) => {
        if (!active) return
        rememberBoard(board)
        setResolved(board)
      },
      (err) => {
        if (active) setError({ slug, message: errorMessage(err) })
      },
    )
    return () => {
      active = false
    }
  }, [slug, knownId])

  const boardId = knownId ?? (resolved?.slug === slug ? resolved.id : null)
  // Keyed by id: a rename changes the address but keeps the same board on screen
  if (boardId) return <BoardPage key={boardId} boardId={boardId} />

  if (error?.slug === slug) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4 text-center">
        <ErrorText>{error.message}</ErrorText>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-600">
          ← Voltar aos quadros
        </Link>
      </div>
    )
  }
  return (
    <div className="mt-16 flex justify-center">
      <Spinner />
    </div>
  )
}

/** Old /boards/<id> links: the board loads by id and moves the address to /quadros/<slug>. */
export function BoardByIdPage() {
  const { boardId } = useParams() as { boardId: string }
  return <BoardPage key={boardId} boardId={boardId} />
}
