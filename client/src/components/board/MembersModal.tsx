import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Member } from '../../lib/types'
import { errorMessage } from '../../lib/api'
import { Modal } from '../Modal'
import { Avatar, Button, ErrorText, Input } from '../ui'

type MembersModalProps = {
  members: Member[]
  currentUserId: string
  onInvite: (email: string) => Promise<void>
  onRemove: (member: Member) => Promise<void>
  onClose: () => void
}

export function MembersModal({ members, currentUserId, onInvite, onRemove, onClose }: MembersModalProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isOwner = members.some((m) => m.userId === currentUserId && m.role === 'OWNER')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleInvite(e: FormEvent) {
    e.preventDefault()
    run(async () => {
      await onInvite(email)
      setEmail('')
    })
  }

  return (
    <Modal title="Membros do quadro" onClose={onClose}>
      {isOwner && (
        <form onSubmit={handleInvite} className="mb-5 flex gap-2">
          <Input
            type="email"
            required
            aria-label="E-mail para convidar"
            placeholder="colega@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={busy} className="shrink-0">
            Convidar
          </Button>
        </form>
      )}
      <ErrorText>{error}</ErrorText>
      <ul className="mt-2 divide-y divide-slate-100">
        {members.map((m) => {
          const isMe = m.userId === currentUserId
          const canRemove = m.role !== 'OWNER' && (isOwner || isMe)
          return (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <Avatar name={m.user.name} id={m.userId} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {m.user.name} {isMe && <span className="text-slate-400">(você)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{m.user.email}</p>
              </div>
              {m.role === 'OWNER' ? (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Dono
                </span>
              ) : (
                canRemove && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => run(() => onRemove(m))}
                    className="text-red-600"
                  >
                    {isMe ? 'Sair' : 'Remover'}
                  </Button>
                )
              )}
            </li>
          )
        })}
      </ul>
      {!isOwner && (
        <p className="mt-3 text-xs text-slate-500">Apenas o dono do quadro pode convidar pessoas.</p>
      )}
    </Modal>
  )
}
