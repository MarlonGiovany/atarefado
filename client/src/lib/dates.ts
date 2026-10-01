// A "day" is a "YYYY-MM-DD" string. The API stores days as UTC midnight, so all
// date math and formatting here happens in UTC to keep the same calendar day
// in every time zone. Only "today" comes from the user's local clock.

const pad = (n: number) => String(n).padStart(2, '0')
const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** True for a real calendar day in YYYY-MM-DD form (rejects e.g. 2026-02-31). */
export function isDayKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = toDate(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Day of an ISO timestamp returned by the API. */
export function dayOf(iso: string) {
  return iso.slice(0, 10)
}

export function addDays(day: string, amount: number) {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

/** The Sunday-to-Saturday week that contains the day. */
export function weekOf(day: string) {
  const start = addDays(day, -toDate(day).getUTCDay())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function format(day: string, options: Intl.DateTimeFormatOptions) {
  return toDate(day).toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' })
}

/** "Quarta-feira, 1 de outubro de 2026" */
export function formatLongDay(day: string) {
  return capitalize(format(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

/** "1 de out." */
export function formatShortDay(day: string) {
  return format(day, { day: 'numeric', month: 'short' })
}

/** "Qua" */
export function weekdayShort(day: string) {
  return capitalize(format(day, { weekday: 'short' }).replace('.', ''))
}

export function dayOfMonth(day: string) {
  return Number(day.slice(8))
}
