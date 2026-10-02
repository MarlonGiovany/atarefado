import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import type { GoogleLinkRequest } from '../auth/useAuth'
import { ApiError, errorMessage } from '../lib/api'
import { checkPassword, PASSWORD_HINT, PASSWORD_MAX_LENGTH } from '../lib/passwordPolicy'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Button, ErrorText, Input, Label } from '../components/ui'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { login, loginWithGoogle, register } = useAuth()
  // e.g. "Senha redefinida" after a password reset
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [linkRequest, setLinkRequest] = useState<GoogleLinkRequest | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'register') {
      const problem = checkPassword(password)
      if (problem) {
        setError(problem)
        return
      }
    }
    setSubmitting(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
    } catch (err) {
      // The API never says whether the e-mail exists; this hint fits every case
      const hint =
        mode === 'login' && err instanceof ApiError && err.status === 401
          ? ' Se você criou a conta com o Google, use “Continuar com o Google”.'
          : ''
      setError(errorMessage(err) + hint)
      setSubmitting(false)
    }
  }

  async function handleGoogle(credential: string) {
    setError('')
    setSubmitting(true)
    try {
      const request = await loginWithGoogle(credential)
      if (request) {
        setLinkRequest(request)
        setSubmitting(false)
      }
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  if (linkRequest) {
    return (
      <AuthLayout>
        <GoogleLinkForm request={linkRequest} onCancel={() => setLinkRequest(null)} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-slate-900">
        {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {mode === 'login' ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
        <button
          type="button"
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
        </button>
      </p>

      {notice && mode === 'login' && (
        <p role="status" className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mode === 'register' && (
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Senha</Label>
            {mode === 'login' && (
              <Link
                to="/esqueci-senha"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Esqueci minha senha
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            maxLength={mode === 'register' ? PASSWORD_MAX_LENGTH : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' && <p className="mt-1 text-xs text-slate-500">{PASSWORD_HINT}</p>}
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>
      {/* Works for both modes: a first Google sign-in creates the account */}
      <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
    </AuthLayout>
  )
}

/**
 * Shown when "Continuar com o Google" matches an existing account that has a
 * password: the Google login is only linked after that password is confirmed.
 */
function GoogleLinkForm({ request, onCancel }: { request: GoogleLinkRequest; onCancel: () => void }) {
  const { confirmGoogleLink } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await confirmGoogleLink(request.linkToken, password)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-slate-900">Vincular sua conta Google</h2>
      <p className="mt-2 text-sm text-slate-600">
        Já existe uma conta no Atarefado com <strong className="text-slate-900">{request.email}</strong>.
        Para entrar com o Google nela, confirme a senha dessa conta. Isso só é pedido uma vez.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="link-password">Senha da conta no Atarefado</Label>
          <Input
            id="link-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Aguarde…' : 'Vincular e entrar'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
          Cancelar
        </Button>
      </form>
      <p className="mt-6 text-xs text-slate-500">
        Esqueceu a senha?{' '}
        <Link to="/esqueci-senha" className="font-medium text-indigo-600 hover:text-indigo-500">
          Redefina por e-mail
        </Link>{' '}
        e depois entre com o Google de novo.
      </p>
    </>
  )
}
