import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-200/60',
  danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-500 shadow-sm focus-visible:outline-red-600',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

// ComponentProps<'input'> includes `ref` (React 19), so callers can focus the field.
// aria-invalid turns the ring red, pairing with a FieldHint error.
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none aria-invalid:ring-2 aria-invalid:ring-red-500 ${className}`}
      {...props}
    />
  )
}

/** Short message under a field: a red error, or a neutral tip when `tone="info"`. */
export function FieldHint({
  id,
  children,
  tone = 'error',
}: {
  id: string
  children: ReactNode
  tone?: 'error' | 'info'
}) {
  if (!children) return null
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : undefined}
      className={`mt-1.5 text-xs ${tone === 'error' ? 'font-medium text-red-600' : 'text-slate-500'}`}
    >
      {children}
    </p>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const spinner = (
    <div
      role="status"
      aria-label="Carregando"
      className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
    />
  )
  if (!fullScreen) return spinner
  return <div className="grid min-h-screen place-items-center">{spinner}</div>
}

const avatarColors = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500',
]

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  // Stable colour per user, derived from their id
  const hash = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const sizeClass = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'
  return (
    <span
      title={name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white ${sizeClass} ${avatarColors[hash % avatarColors.length]}`}
    >
      {initials}
    </span>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-900">
      <img src="/favicon.svg" alt="" className="size-7" />
      Atarefado
    </span>
  )
}

export function TrashIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Credit() {
  return (
    <p className="text-xs text-slate-500">
      Desenvolvido por <span className="font-semibold text-slate-700">Marlon Giovany</span>
      {' · '}
      <Link to="/privacidade" className="hover:text-slate-700 hover:underline">
        Privacidade
      </Link>
    </p>
  )
}
