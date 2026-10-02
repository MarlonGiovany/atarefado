import { useEffect, useRef } from 'react'
import type { Notice } from '../lib/notice'

/** Short-lived message at the bottom of the screen. Render with key={notice.id}. */
export function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Messages with an action (e.g. "Desfazer") stay longer so there's time to use it
  const duration = notice.action ? 10_000 : 5_000
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), duration)
    return () => clearTimeout(timer)
  }, [duration])

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{notice.message}</span>
      <div className="flex shrink-0 items-center gap-1">
        {notice.action && (
          <button
            type="button"
            onClick={() => {
              notice.action?.onClick()
              onClose()
            }}
            className="rounded-md px-2 py-1 font-semibold text-indigo-300 hover:bg-white/10"
          >
            {notice.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="rounded-md px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
