import { useAuth } from '../auth/useAuth'
import { Button, Credit, Logo } from './ui'

/** Shown while a saved session can't be checked because the API is unreachable. */
export function ServerUnavailable() {
  const { retry, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div
          role="alert"
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <h1 className="font-semibold text-slate-900">Sem conexão com o servidor</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua sessão continua salva. Estamos tentando reconectar automaticamente.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={retry}>Tentar agora</Button>
            <Button variant="ghost" onClick={logout}>
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-12">
        <Credit />
      </div>
    </div>
  )
}
