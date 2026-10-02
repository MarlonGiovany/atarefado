import { Button } from '../ui'

type PendingBannerProps = {
  count: number
  /** Title of the board's last column, which counts as "done"; null if there isn't one */
  doneColumnTitle: string | null
  busy: boolean
  onCarryOver: () => void
}

/** Offers to bring unfinished tasks from earlier days into today. */
export function PendingBanner({ count, doneColumnTitle, busy, onCarryOver }: PendingBannerProps) {
  const tasks = count === 1 ? '1 tarefa pendente' : `${count} tarefas pendentes`

  return (
    <div
      role="region"
      aria-label="Tarefas pendentes"
      className="mx-4 mb-4 flex flex-col gap-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 sm:mx-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Você tem {tasks} de dias anteriores
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            {doneColumnTitle
              ? `Tarefas que ainda não chegaram em “${doneColumnTitle}”. Elas continuam na mesma coluna.`
              : 'Elas continuam na mesma coluna.'}
          </p>
        </div>
      </div>
      <Button onClick={onCarryOver} disabled={busy} className="shrink-0">
        {busy ? 'Trazendo…' : 'Trazer para hoje'}
      </Button>
    </div>
  )
}
