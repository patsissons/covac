import type { Occurrence } from '@/types/snapshot'
import { dateOf, dayOfWeek, timeOf, toMinutes, weekDays, type DateString } from './dates'
import type { SnapshotIndex } from './index'

export type ViewMode = 'time' | 'location'

export interface Filters {
  /** Monday of the week being viewed. */
  weekStart: DateString
  /** Stack every location into hourly rows, or one row per location. */
  view: ViewMode
  /** Empty means all calendars. */
  calendarIds: number[]
  /** Empty means all centres. */
  centerIds: number[]
  /** Earliest start time `HH:mm`, or empty. */
  from: string
  /** Latest start time `HH:mm`, or empty. */
  to: string
  /** Days of week (0 = Sunday) to include; empty means all. */
  days: number[]
  /** Case-insensitive search over title and instructors. */
  q: string
  /** Lowest price in dollars to include, or null for no minimum. */
  priceMin: number | null
  /** Highest price in dollars to include, or null for no maximum. */
  priceMax: number | null
}

export function emptyFilters(weekStart: DateString): Filters {
  return {
    weekStart,
    view: 'time',
    calendarIds: [],
    centerIds: [],
    from: '',
    to: '',
    days: [],
    q: '',
    priceMin: null,
    priceMax: null,
  }
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.calendarIds.length > 0 ||
    filters.centerIds.length > 0 ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.days.length > 0 ||
    filters.q.trim() !== '' ||
    filters.priceMin !== null ||
    filters.priceMax !== null
  )
}

/** Occurrences in the selected week that match every active filter, in start order. */
export function applyFilters(index: SnapshotIndex, filters: Filters): Occurrence[] {
  const calendars = new Set(filters.calendarIds)
  const centers = new Set(filters.centerIds)
  const days = new Set(filters.days)
  const from = filters.from ? toMinutes(filters.from) : -1
  const to = filters.to ? toMinutes(filters.to) : Infinity
  const q = filters.q.trim().toLowerCase()
  const { priceMin, priceMax } = filters
  // With a price bound set, activities whose price is unknown are left out.
  const priced = priceMin !== null || priceMax !== null

  const result: Occurrence[] = []
  for (const day of weekDays(filters.weekStart)) {
    if (days.size && !days.has(dayOfWeek(day))) continue
    for (const occurrence of index.byDay.get(day) ?? []) {
      const start = toMinutes(timeOf(occurrence.s))
      if (start < from || start > to) continue
      const activity = index.activityById.get(occurrence.a)
      if (!activity) continue
      if (calendars.size && !calendars.has(activity.calendarId)) continue
      if (centers.size && !centers.has(activity.centerId)) continue
      if (q && !matchesQuery(activity.title, activity.instructors, q)) continue
      if (priced) {
        const price = index.priceById.get(activity.id)
        if (price === undefined) continue
        if (priceMin !== null && price < priceMin) continue
        if (priceMax !== null && price > priceMax) continue
      }
      result.push(occurrence)
    }
  }
  return result
}

function matchesQuery(title: string, instructors: string[], q: string): boolean {
  if (title.toLowerCase().includes(q)) return true
  return instructors.some((name) => name.toLowerCase().includes(q))
}

export type CenterDayGrid = Map<number, Map<DateString, Occurrence[]>>

/** Group filtered occurrences into centre → day → occurrences. */
export function groupByCenterAndDay(
  index: SnapshotIndex,
  occurrences: Occurrence[],
): CenterDayGrid {
  const grid: CenterDayGrid = new Map()
  for (const occurrence of occurrences) {
    const centerId = index.activityById.get(occurrence.a)?.centerId
    if (centerId === undefined) continue
    let days = grid.get(centerId)
    if (!days) grid.set(centerId, (days = new Map()))
    const day = dateOf(occurrence.s)
    const list = days.get(day)
    if (list) list.push(occurrence)
    else days.set(day, [occurrence])
  }
  return grid
}

export type HourDayGrid = Map<number, Map<DateString, Occurrence[]>>

/** Group filtered occurrences into start hour (0–23) → day → occurrences, across all centres. */
export function groupByHourAndDay(occurrences: Occurrence[]): HourDayGrid {
  const grid: HourDayGrid = new Map()
  for (const occurrence of occurrences) {
    const hour = Math.floor(toMinutes(timeOf(occurrence.s)) / 60)
    let days = grid.get(hour)
    if (!days) grid.set(hour, (days = new Map()))
    const day = dateOf(occurrence.s)
    const list = days.get(day)
    if (list) list.push(occurrence)
    else days.set(day, [occurrence])
  }
  return grid
}

/** Distinct centre ids present in the occurrences, sorted by centre name. */
export function visibleCenterIds(index: SnapshotIndex, occurrences: Occurrence[]): number[] {
  const ids = new Set<number>()
  for (const occurrence of occurrences) {
    const centerId = index.activityById.get(occurrence.a)?.centerId
    if (centerId !== undefined) ids.add(centerId)
  }
  return [...ids].sort((a, b) =>
    (index.centerById.get(a)?.name ?? '').localeCompare(index.centerById.get(b)?.name ?? ''),
  )
}

/**
 * Toggle every calendar in a group: if all of them are already selected they are removed,
 * otherwise they are all added. Returns the new calendar id selection.
 */
export function toggleCalendarGroup(
  index: SnapshotIndex,
  calendarIds: number[],
  group: string,
): number[] {
  const groupIds = index.snapshot.calendars.filter((c) => c.group === group).map((c) => c.id)
  const selected = new Set(calendarIds)
  const allSelected = groupIds.every((id) => selected.has(id))
  if (allSelected) return calendarIds.filter((id) => !groupIds.includes(id))
  return [...calendarIds, ...groupIds.filter((id) => !selected.has(id))]
}

/** 'all' | 'some' | 'none' of a group's calendars are in the selection. */
export function groupSelection(
  index: SnapshotIndex,
  calendarIds: number[],
  group: string,
): 'all' | 'some' | 'none' {
  const groupIds = index.snapshot.calendars.filter((c) => c.group === group).map((c) => c.id)
  const selected = new Set(calendarIds)
  const count = groupIds.filter((id) => selected.has(id)).length
  return count === 0 ? 'none' : count === groupIds.length ? 'all' : 'some'
}
