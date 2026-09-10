import type { Activity, Calendar, Center, Facility, Occurrence, Snapshot } from '@/types/snapshot'
import { dateOf, type DateString } from './dates'

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
  return {
    snapshot,
    activityById: new Map(snapshot.activities.map((a) => [a.id, a])),
    centerById: new Map(snapshot.centers.map((c) => [c.id, c])),
    calendarById: new Map(snapshot.calendars.map((c) => [c.id, c])),
    facilityById: new Map(snapshot.facilities.map((f) => [f.id, f])),
    byDay,
    groups,
  }
}
