/** Helpers shared by several tools. */
import type { CatalogActivity } from '../../src/data/catalog.ts'
import { addDays, type DateString } from '../../src/data/dates.ts'
import { deepLink } from '../../src/data/links.ts'
import { priceLabel } from '../../src/data/markdown.ts'
import type { SearchContext } from '../../src/data/search.ts'
import type { Calendar } from '../../src/types/snapshot.ts'

export const MAX_RANGE_DAYS = 56

/** Resolve a requested date range: defaults to a week from today, clamped to the snapshot. */
export function resolveRange(
  from: DateString | undefined,
  to: DateString | undefined,
  today: DateString,
  period: { start: string; end: string },
): { from: DateString; to: DateString; note?: string } {
  const defaultStart = today < period.start ? period.start : today > period.end ? period.end : today
  let start = from ?? defaultStart
  let end = to ?? addDays(start, 6)
  if (end < start) [start, end] = [end, start]
  let note: string | undefined
  if (start < period.start || end > period.end) {
    note = `The snapshot covers ${period.start} to ${period.end}; the range was clamped to it.`
    if (start < period.start) start = period.start
    if (end > period.end) end = period.end
    if (end < start) end = start
  }
  if (addDays(start, MAX_RANGE_DAYS - 1) < end) end = addDays(start, MAX_RANGE_DAYS - 1)
  return { from: start, to: end, note }
}

/** Calendar ids for a group name (case-insensitive), or undefined when the group is unknown. */
export function calendarIdsForGroup(calendars: Calendar[], group: string): number[] | undefined {
  const wanted = group.trim().toLowerCase()
  const ids = calendars.filter((c) => c.group.toLowerCase() === wanted).map((c) => c.id)
  return ids.length ? ids : undefined
}

export function summarise(activity: CatalogActivity, ctx: SearchContext, site: string) {
  const centre = ctx.centerById.get(activity.centerId)
  const calendar = ctx.calendarById.get(activity.calendarId)
  return {
    id: activity.id,
    title: activity.title,
    centre: { id: activity.centerId, name: centre?.name ?? `Centre ${activity.centerId}` },
    calendar: {
      id: activity.calendarId,
      name: calendar?.name ?? `Calendar ${activity.calendarId}`,
      group: calendar?.group ?? 'Other',
    },
    price: priceLabel(activity),
    priceAmount: activity.price,
    free: activity.free || activity.price === 0,
    ages: activity.ageText,
    openings: activity.openings,
    availability: activity.availability,
    spaces: activity.spaces,
    instructors: activity.instructors,
    url: `${site}/activities/${activity.id}/`,
  }
}

export function calendarLink(
  site: string,
  weekStart: DateString,
  filters: {
    centerIds?: number[]
    calendarIds?: number[]
    q?: string
    from?: string
    to?: string
    days?: number[]
    priceMax?: number
    openOnly?: boolean
  },
): string {
  return deepLink(
    {
      weekStart,
      centerIds: filters.centerIds ?? [],
      calendarIds: filters.calendarIds ?? [],
      q: filters.q ?? '',
      from: filters.from ?? '',
      to: filters.to ?? '',
      days: filters.days ?? [],
      priceMax: filters.priceMax ?? null,
      openOnly: filters.openOnly ?? false,
    },
    site,
  )
}
