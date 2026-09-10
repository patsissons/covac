import type { Occurrence } from '@/types/snapshot'
import { dateOf, dayOfWeek, timeOf, toMinutes, weekDays, type DateString } from './dates'
import type { SnapshotIndex } from './index'

export interface Filters {
  /** Monday of the week being viewed. */
  weekStart: DateString
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
}

export function emptyFilters(weekStart: DateString): Filters {
  return { weekStart, calendarIds: [], centerIds: [], from: '', to: '', days: [], q: '' }
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.calendarIds.length > 0 ||
    filters.centerIds.length > 0 ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.days.length > 0 ||
    filters.q.trim() !== ''
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
