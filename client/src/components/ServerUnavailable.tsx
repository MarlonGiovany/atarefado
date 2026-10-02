import { useAuth } from '../auth/useAuth'
import { Button, Credit, Logo } from './ui'

/** Shown while the session can't be checked because the API is unreachable. */
export function ServerUnavailable() {
  const { retry } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div role="alert" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="font-semibold text-slate-900">Sem conexão com o servidor</h1>
          <p className="mt-2 text-sm text-slate-600">
            Estamos tentando reconectar automaticamente. Se você já estava conectado, sua sessão
            continua salva.
          </p>
          <div className="mt-6">
            <Button onClick={retry} className="w-full">
              Tentar agora
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
