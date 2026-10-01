import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { errorMessage } from '../lib/api'
import { Button, Credit, ErrorText, Input, Label, Logo } from '../components/ui'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-indigo-600 p-12 text-white lg:flex">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg ring-2 ring-white/30" />
          Atarefado
        </span>
        <div>
          <h1 className="text-4xl leading-tight font-bold">
            Planeje, acompanhe e entregue em equipe.
          </h1>
          <p className="mt-4 max-w-md text-indigo-100">
            Quadros Kanban para o seu time: arraste cards entre colunas, atribua tarefas e
            mantenha todos os prazos sob controle.
          </p>
        </div>
        <p className="text-sm text-indigo-200">
          Desenvolvido por <span className="font-semibold text-white">Marlon Giovany</span>
          {' · '}React, Express e Prisma
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
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

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'register' && (
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
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
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'register' && (
                <p className="mt-1 text-xs text-slate-500">No mínimo 8 caracteres.</p>
              )}
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>
        <div className="mt-12 lg:hidden">
          <Credit />
        </div>
      </section>
    </div>
  )
}
