import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api, ApiError, errorMessage } from '../lib/api'
import { checkPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../lib/passwordPolicy'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Avatar, Button, ErrorText, Input, Label } from '../components/ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Ativo' : 'Não configurado'}
    </span>
  )
}

function PasswordForm() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const hasPassword = Boolean(user?.hasPassword)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [needsRelogin, setNeedsRelogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const problem = checkPassword(password)
    if (problem) return setError(problem)
    if (password !== confirmation) return setError('As duas senhas não são iguais.')

    setSubmitting(true)
    try {
      const { message } = await api<{ message: string }>('/account/password', 'PUT', {
        ...(hasPassword && { currentPassword: current }),
        newPassword: password,
      })
      setSuccess(
        hasPassword ? `${message} Outros dispositivos foram desconectados.` : message,
      )
      setCurrent('')
      setPassword('')
      setConfirmation('')
      await refreshUser()
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'recent_login_required') setNeedsRelogin(true)
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hasPassword && (
        <p className="text-sm text-slate-600">
          Sua conta entra só com o Google. Se quiser, crie uma senha para também poder entrar com
          e-mail e senha.
        </p>
      )}
      {hasPassword && (
        <div>
          <Label htmlFor="current-password">Senha atual</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="account-new-password">{hasPassword ? 'Nova senha' : 'Senha'}</Label>
          <Input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="account-confirm-password">Repita a senha</Label>
          <Input
            id="account-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">{PASSWORD_HINT}</p>
      <ErrorText>{error}</ErrorText>
      {success && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : hasPassword ? 'Alterar senha' : 'Criar senha'}
        </Button>
        {needsRelogin && (
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            Sair e entrar novamente
          </Button>
        )}
      </div>
    </form>
  )
}

export function AccountPage() {
  const { user, logoutEverywhere } = useAuth()
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} id={user.id} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">Minha conta</h1>
          <p className="truncate text-sm text-slate-500">
            {user.name} · {user.email}
          </p>
        </div>
      </div>

      <Section title="Formas de entrar">
        <ul className="divide-y divide-slate-100 text-sm">
          <li className="flex items-center justify-between py-2">
            <span>E-mail e senha</span>
            <StatusBadge active={Boolean(user.hasPassword)} />
          </li>
          <li className="flex items-center justify-between py-2">
            <span>Google</span>
            <StatusBadge active={Boolean(user.hasGoogle)} />
          </li>
        </ul>
      </Section>

      <Section title={user.hasPassword ? 'Alterar senha' : 'Criar senha'}>
        <PasswordForm />
      </Section>

      <Section title="Sessões">
        <p className="text-sm text-slate-600">
          Desconecta esta e todas as outras sessões abertas, em qualquer navegador ou aparelho.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setConfirmingLogout(true)}>
          Sair de todos os dispositivos
        </Button>
      </Section>

      {confirmingLogout && (
        <ConfirmDialog
          title="Sair de todos os dispositivos"
          message="Todas as sessões serão encerradas, inclusive esta. Você precisará entrar de novo."
          confirmLabel="Sair de todos"
          onConfirm={logoutEverywhere}
          onClose={() => setConfirmingLogout(false)}
        />
      )}
    </div>
  )
}
