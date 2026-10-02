import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { Avatar, Button, Credit, Logo } from './ui'

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-md">
            <Logo />
          </Link>
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/conta"
                title="Minha conta"
                className="flex items-center gap-3 rounded-full py-1 pr-1 pl-2 hover:bg-slate-100 sm:pl-3"
              >
                <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
                <Avatar name={user.name} id={user.id} />
              </Link>
              <Button variant="ghost" onClick={logout}>
                Sair
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center">
        <Credit />
      </footer>
    </div>
  )
}
