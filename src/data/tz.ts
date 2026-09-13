/**
 * Vancouver time helpers. The snapshot stores naive local times; these turn them into offset-aware
 * ISO strings for structured data, and give "today" in Vancouver for code that runs in UTC
 * (Cloudflare Workers, CI).
 */
import type { DateString } from './dates'

export const TIME_ZONE = 'America/Vancouver'

const DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const CLOCK_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Today's date in Vancouver, `YYYY-MM-DD`. */
export function vancouverToday(now: Date = new Date()): DateString {
  // en-CA formats as YYYY-MM-DD already; normalise in case an ICU build inserts other separators.
  const parts = DATE_PARTS.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** UTC offset of Vancouver at an instant, in minutes east of UTC (so PDT is -420). */
function offsetAt(ms: number): number {
  const parts = CLOCK_PARTS.formatToParts(new Date(ms))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000)
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** `-07:00` or `-08:00` for a naive Vancouver `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DD`) string. */
export function vancouverOffset(naive: string): string {
  const [date = '', time = '12:00'] = naive.split('T')
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  const [hh = 0, mm = 0] = time.split(':').map(Number)
  // Guess the instant as if the wall clock were UTC, then correct with the offset in force there.
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = offsetAt(guess)
  const second = offsetAt(guess - first * 60_000)
  return formatOffset(second)
}

/** `2026-09-14T07:00` → `2026-09-14T07:00:00-07:00`. */
export function toOffsetIso(naive: string): string {
  const [date = '', time = '00:00'] = naive.split('T')
  return `${date}T${time}:00${vancouverOffset(naive)}`
}
