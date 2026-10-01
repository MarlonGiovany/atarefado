import { z } from "zod";

// A "day" travels over the API as "YYYY-MM-DD" and is stored as UTC midnight,
// so it means the same calendar day regardless of the server's time zone.

export const dayString = z.iso.date();

export function dayToDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Fallback for clients that don't send a day; the client normally sends its local day. */
export function todayUtc() {
  return dayToDate(new Date().toISOString().slice(0, 10));
}
