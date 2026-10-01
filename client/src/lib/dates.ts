// Due dates are stored as UTC midnight, so we read and format them in UTC
// to avoid showing the previous day in negative-offset time zones.

export function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : ''
}

export function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function todayLocal() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dueStatus(iso: string): 'overdue' | 'today' | 'upcoming' {
  const due = toDateInput(iso)
  const today = todayLocal()
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}
