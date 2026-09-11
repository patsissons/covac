import type { Activity, Calendar, Center, Facility, Occurrence, Snapshot } from '@/types/snapshot'
import { dateOf, type DateString } from './dates'
import { activityPrice, priceCeiling } from './prices'

/** Lookup tables over a snapshot, built once after load. */
export interface SnapshotIndex {
  snapshot: Snapshot
  activityById: Map<number, Activity>
  centerById: Map<number, Center>
  calendarById: Map<number, Calendar>
  facilityById: Map<number, Facility>
  /** Occurrences per local date, in start-time order. */
  byDay: Map<DateString, Occurrence[]>
  /** Calendar groups in display order. */
  groups: string[]
  /** Lowest known price per activity id; activities without a price are absent. */
  priceById: Map<number, number>
  /** Top of the price slider, derived from the priciest activity. */
  priceCeiling: number
}

export function buildIndex(snapshot: Snapshot): SnapshotIndex {
  const byDay = new Map<DateString, Occurrence[]>()
  for (const occurrence of snapshot.occurrences) {
    const day = dateOf(occurrence.s)
    const list = byDay.get(day)
    if (list) list.push(occurrence)
    else byDay.set(day, [occurrence])
  }
  const groups = [...new Set(snapshot.calendars.map((c) => c.group))].sort((a, b) =>
    a === 'Drop-in' ? -1 : b === 'Drop-in' ? 1 : a.localeCompare(b),
  )
  const priceById = new Map<number, number>()
  for (const activity of snapshot.activities) {
    const price = activityPrice(activity)
    if (price !== undefined) priceById.set(activity.id, price)
  }
  return {
    snapshot,
    activityById: new Map(snapshot.activities.map((a) => [a.id, a])),
    centerById: new Map(snapshot.centers.map((c) => [c.id, c])),
    calendarById: new Map(snapshot.calendars.map((c) => [c.id, c])),
    facilityById: new Map(snapshot.facilities.map((f) => [f.id, f])),
    byDay,
    groups,
    priceById,
    priceCeiling: priceCeiling(priceById.values()),
  }
}
