import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { api, errorMessage } from '../lib/api'
import { checkPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../lib/passwordPolicy'
import { AuthLayout } from '../components/AuthLayout'
import { Button, ErrorText, Input, Label } from '../components/ui'

/** The e-mail link carries the token in the URL fragment (#token=…), never sent to servers. */
function readTokenFromHash() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token')
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [token] = useState(readTokenFromHash)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Remove the token from the address bar and history as soon as it's read
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const problem = checkPassword(password)
    if (problem) return setError(problem)
    if (password !== confirmation) return setError('As duas senhas não são iguais.')

    setSubmitting(true)
    try {
      const { message } = await api<{ message: string }>('/auth/reset-password', 'POST', {
        token,
        password,
      })
      // Every session was signed out on the server; reflect that here too
      if (user) await logout()
      navigate('/login', { replace: true, state: { notice: message } })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h2 className="text-2xl font-bold text-slate-900">Link inválido</h2>
        <p className="mt-2 text-sm text-slate-600">
          Este link de redefinição está incompleto ou já foi usado. Peça um novo e-mail.
        </p>
        <Link
          to="/esqueci-senha"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Pedir novo link →
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-slate-900">Criar nova senha</h2>
      <p className="mt-1 text-sm text-slate-500">
        Depois de salvar, você sairá de todos os dispositivos e entrará com a nova senha.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{PASSWORD_HINT}</p>
        </div>
        <div>
          <Label htmlFor="confirm-password">Repita a nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
      <p className="mt-8 text-sm">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          ← Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  )
}
