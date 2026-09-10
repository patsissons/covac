import { isDateString, startOfWeek, type DateString } from './dates'
import { emptyFilters, type Filters } from './filters'

const TIME = /^\d{2}:\d{2}$/

const numbers = (value: string | null): number[] =>
  (value ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)

/** Parse filters from a query string; unknown or invalid values fall back to defaults. */
export function filtersFromSearch(search: string, defaultWeek: DateString): Filters {
  const params = new URLSearchParams(search)
  const week = params.get('week')
  const filters = emptyFilters(isDateString(week) ? startOfWeek(week) : defaultWeek)
  filters.calendarIds = numbers(params.get('cal'))
  filters.centerIds = numbers(params.get('centers'))
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  filters.from = TIME.test(from) ? from : ''
  filters.to = TIME.test(to) ? to : ''
  filters.days = numbers(params.get('days')).filter((d) => d <= 6)
  filters.q = params.get('q') ?? ''
  return filters
}

/** Serialize filters to a query string, omitting defaults so URLs stay short. */
export function filtersToSearch(filters: Filters, defaultWeek: DateString): string {
  const params = new URLSearchParams()
  if (filters.weekStart !== defaultWeek) params.set('week', filters.weekStart)
  if (filters.calendarIds.length) params.set('cal', filters.calendarIds.join(','))
  if (filters.centerIds.length) params.set('centers', filters.centerIds.join(','))
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.days.length) params.set('days', filters.days.join(','))
  if (filters.q.trim()) params.set('q', filters.q.trim())
  const search = params.toString()
  return search ? `?${search}` : ''
}
