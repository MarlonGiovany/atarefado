import {
  addDays,
  dayOfMonth,
  formatLongDay,
  isDayKey,
  weekdayShort,
  weekOf,
} from '../../lib/dates'
import { Button } from '../ui'

type DateBarProps = {
  /** Selected day (YYYY-MM-DD) */
  day: string
  today: string
  /** Number of cards per day for the visible week */
  counts: Record<string, number>
  onChange: (day: string) => void
}

function relativeLabel(day: string, today: string) {
  if (day === today) return 'Hoje'
  if (day === addDays(today, -1)) return 'Ontem'
  if (day === addDays(today, 1)) return 'Amanhã'
  return null
}

const taskCount = (n: number) => (n === 1 ? '1 tarefa' : `${n} tarefas`)

function ArrowButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Dia anterior' : 'Próximo dia'}
      title={direction === 'prev' ? 'Dia anterior' : 'Próximo dia'}
      className="grid size-8 shrink-0 place-items-center rounded-lg sm:size-9 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5">
        <path
          fillRule="evenodd"
          d={
            direction === 'prev'
              ? 'M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z'
              : 'M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z'
          }
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}

export function DateBar({ day, today, counts, onChange }: DateBarProps) {
  const label = relativeLabel(day, today)

  return (
    <section
      aria-label="Navegação por data"
      className="mx-4 mb-4 rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:mx-6 sm:p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 aria-live="polite" className="text-sm font-semibold text-slate-900 sm:text-base">
            {formatLongDay(day)}
          </h2>
          {label && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                day === today ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="day-picker" className="sr-only">
            Escolher data
          </label>
          <input
            id="day-picker"
            type="date"
            required
            value={day}
            onChange={(e) => isDayKey(e.target.value) && onChange(e.target.value)}
            className="rounded-lg border-0 bg-white px-2.5 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          />
          <Button variant="secondary" onClick={() => onChange(today)} disabled={day === today}>
            Hoje
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-0.5 sm:gap-1">
        <ArrowButton direction="prev" onClick={() => onChange(addDays(day, -1))} />
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-0.5 sm:gap-1">
          {weekOf(day).map((d) => {
            const selected = d === day
            const isToday = d === today
            const count = counts[d] ?? 0
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => onChange(d)}
                  aria-pressed={selected}
                  aria-label={`${formatLongDay(d)}${isToday ? ' (hoje)' : ''}, ${taskCount(count)}`}
                  className={`flex w-full flex-col items-center rounded-lg py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${
                    selected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isToday
                        ? 'text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`text-[10px] font-medium uppercase sm:text-xs ${
                      selected ? 'text-indigo-100' : isToday ? 'text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    {weekdayShort(d)}
                  </span>
                  <span className="text-sm font-semibold sm:text-base">{dayOfMonth(d)}</span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 min-w-5 rounded-full px-1 text-[10px] leading-4 font-semibold ${
                      count === 0
                        ? 'invisible'
                        : selected
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <ArrowButton direction="next" onClick={() => onChange(addDays(day, 1))} />
      </div>
    </section>
  )
}
