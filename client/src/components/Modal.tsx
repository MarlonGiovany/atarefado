import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'lg'
}

// Open modals, innermost last: Escape only closes the one on top
const openModals: symbol[] = []

export function Modal({ title, onClose, children, size = 'lg' }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the mount effect (which moves focus)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const id = Symbol()
    openModals.push(id)
    const previousFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals.at(-1) === id) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    bodyRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => {
      openModals.splice(openModals.indexOf(id), 1)
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-16 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 ${size === 'sm' ? 'max-w-sm' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div ref={bodyRef} className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
