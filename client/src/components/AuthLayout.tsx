import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Credit, Logo } from './ui'

/** Two-column layout shared by login, password reset and other signed-out pages. */
export function AuthLayout({ children }: { children: ReactNode }) {
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
          {' · '}
          <Link to="/privacidade" className="hover:text-white hover:underline">
            Privacidade
          </Link>
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
        <div className="mt-12 lg:hidden">
          <Credit />
        </div>
      </section>
    </div>
  )
}
