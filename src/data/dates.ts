/** Naive local-date helpers over `YYYY-MM-DD` strings (the snapshot carries no timezone). */

export type DateString = string // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateString(date: Date): DateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDate(value: DateString): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function isDateString(value: unknown): value is DateString {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(parseDate(value).getTime())
  )
}

export function today(): DateString {
  return toDateString(new Date())
}

export function addDays(value: DateString, days: number): DateString {
  const date = parseDate(value)
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

/** Monday-based week start. */
export function startOfWeek(value: DateString): DateString {
  const date = parseDate(value)
  const offset = (date.getDay() + 6) % 7
  return addDays(value, -offset)
}

export function weekDays(weekStart: DateString): DateString[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
export function dayOfWeek(value: DateString): number {
  return parseDate(value).getDay()
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-09-14` → `Mon Sep 14`. */
export function formatDay(value: DateString): string {
  const date = parseDate(value)
  return `${DAY_LABELS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

/** `2026-09-14` → `Sep 14, 2026`. */
export function formatDate(value: DateString): string {
  const date = parseDate(value)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/** `14:05` → `2:05 pm`; `09:00` → `9:00 am`. */
export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad(m)} ${suffix}`
}

/** Time portion of a `YYYY-MM-DDTHH:mm` occurrence timestamp. */
export function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

/** Date portion of a `YYYY-MM-DDTHH:mm` occurrence timestamp. */
export function dateOf(iso: string): DateString {
  return iso.slice(0, 10)
}

/** Minutes since midnight for an `HH:mm` string. */
export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}
