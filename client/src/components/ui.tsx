import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-200/60',
  danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
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

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none ${className}`}
      {...props}
    />
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
      aria-label="Loading"
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
      TaskFlow
    </span>
  )
}
