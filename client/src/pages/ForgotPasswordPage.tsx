import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../lib/api'
import { AuthLayout } from '../components/AuthLayout'
import { Button, ErrorText, Input, Label } from '../components/ui'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sentMessage, setSentMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Always the same answer, whether or not the e-mail has an account
      const { message } = await api<{ message: string }>('/auth/forgot-password', 'POST', { email })
      setSentMessage(message)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-slate-900">Esqueci minha senha</h2>
      {sentMessage ? (
        <>
          <p role="status" className="mt-6 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            {sentMessage}
          </p>
          <p className="mt-4 text-sm text-slate-600">
            O link vale por 30 minutos e só pode ser usado uma vez. Confira também a caixa de spam.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Enviando…' : 'Enviar link de redefinição'}
            </Button>
          </form>
        </>
      )}
      <p className="mt-8 text-sm">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          ← Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  )
}
