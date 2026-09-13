/**
 * Compact derived views of the snapshot ("shards") that the build writes under `dist/data/` for
 * the MCP server and other machine readers. The Cloudflare Workers free plan allows 10 ms of CPU
 * per request and parsing the full 4 MB snapshot takes longer than that, so every shard is sized
 * to be parsed in a few milliseconds and each request reads only what it needs.
 */
import type {
  Activity,
  Calendar,
  Center,
  Facility,
  Occurrence,
  Snapshot,
  SnapshotMeta,
} from '@/types/snapshot'
import { addDays, dateOf, startOfWeek, type DateString } from './dates'
import type { SnapshotIndex } from './index'
import { activityDeepLink, activityPageUrl } from './links'
import { activityPrice } from './prices'
import { blurb, htmlToText } from './text'

/** One activity without its description HTML, fee table or URL: enough to search and filter. */
export interface CatalogActivity {
  id: number
  title: string
  calendarId: number
  centerId: number
  instructors?: string[]
  priceText: string
  free: boolean
  /** Lowest known price in dollars (0 = free); absent when the snapshot has no price. */
  price?: number
  ageMin?: number
  ageMax?: number
  ageText?: string
  openings?: string
  /** First ~200 characters of the plain-text description. */
  blurb?: string
  /** Earliest and latest session start in the snapshot window, and the number of sessions. */
  first?: string
  last?: string
  n: number
}

export interface Catalog {
  generatedAt: string
  period: Snapshot['period']
  activities: CatalogActivity[]
}

export interface CentreSummary extends Center {
  /** Number of activities held at the centre. */
  activities: number
}

export interface CentresShard {
  centres: CentreSummary[]
  facilities: Facility[]
}

/** All sessions in one Monday-based week. */
export interface WeekShard {
  week: DateString
  occurrences: Occurrence[]
}

/** Everything about one activity, including its sessions and covac links. */
export interface ActivityDetail extends Activity {
  descriptionText: string
  center: Center
  calendar: Calendar
  facilities: string[]
  sessions: Occurrence[]
  /** Prerendered page on covac.fyi. */
  pageUrl: string
  /** Calendar deep link for the week of the first upcoming (or last) session. */
  link: string
}

export interface SiteMeta extends SnapshotMeta {
  /** Mondays of every week that has at least one session. */
  weeks: DateString[]
  /** covac package version that generated the shards. */
  version: string
}

export function occurrencesByActivity(occurrences: Occurrence[]): Map<number, Occurrence[]> {
  const map = new Map<number, Occurrence[]>()
  for (const occurrence of occurrences) {
    const list = map.get(occurrence.a)
    if (list) list.push(occurrence)
    else map.set(occurrence.a, [occurrence])
  }
  return map
}

export function toCatalogActivity(activity: Activity, sessions: Occurrence[]): CatalogActivity {
  const price = activityPrice(activity)
  const text = blurb(htmlToText(activity.description))
  const row: CatalogActivity = {
    id: activity.id,
    title: activity.title,
    calendarId: activity.calendarId,
    centerId: activity.centerId,
    priceText: activity.priceText,
    free: activity.free,
    n: sessions.length,
  }
  if (activity.instructors.length) row.instructors = activity.instructors
  if (price !== undefined) row.price = price
  if (activity.ageMin !== undefined) row.ageMin = activity.ageMin
  if (activity.ageMax !== undefined) row.ageMax = activity.ageMax
  if (activity.ageText) row.ageText = activity.ageText
  if (activity.openings) row.openings = activity.openings
  if (text) row.blurb = text
  if (sessions.length) {
    row.first = sessions[0]!.s
    row.last = sessions[sessions.length - 1]!.s
  }
  return row
}

export function buildCatalog(snapshot: Snapshot): Catalog {
  const byActivity = occurrencesByActivity(snapshot.occurrences)
  return {
    generatedAt: snapshot.generatedAt,
    period: snapshot.period,
    activities: snapshot.activities.map((a) => toCatalogActivity(a, byActivity.get(a.id) ?? [])),
  }
}

export function buildCentres(snapshot: Snapshot): CentresShard {
  const counts = new Map<number, number>()
  for (const activity of snapshot.activities) {
    counts.set(activity.centerId, (counts.get(activity.centerId) ?? 0) + 1)
  }
  return {
    centres: snapshot.centers.map((c) => ({ ...c, activities: counts.get(c.id) ?? 0 })),
    facilities: snapshot.facilities,
  }
}

/** Bucket occurrences by the Monday of their week, in week order. */
export function buildWeekShards(snapshot: Snapshot): WeekShard[] {
  const weeks = new Map<DateString, Occurrence[]>()
  for (const occurrence of snapshot.occurrences) {
    const week = startOfWeek(dateOf(occurrence.s))
    const list = weeks.get(week)
    if (list) list.push(occurrence)
    else weeks.set(week, [occurrence])
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, occurrences]) => ({ week, occurrences }))
}

/** Mondays of every week touching the inclusive date range. */
export function weeksCovering(from: DateString, to: DateString): DateString[] {
  const weeks: DateString[] = []
  for (let week = startOfWeek(from); week <= to; week = addDays(week, 7)) weeks.push(week)
  return weeks
}

/** The session a reader most likely wants: the first one starting today or later, else the last. */
export function nextSession(sessions: Occurrence[], today: DateString): Occurrence | undefined {
  return sessions.find((s) => dateOf(s.s) >= today) ?? sessions[sessions.length - 1]
}

export function buildActivityDetail(
  index: SnapshotIndex,
  activity: Activity,
  sessions: Occurrence[],
  today: DateString,
  site?: string,
): ActivityDetail {
  const center = index.centerById.get(activity.centerId) ?? {
    id: activity.centerId,
    name: `Centre ${activity.centerId}`,
  }
  const calendar = index.calendarById.get(activity.calendarId) ?? {
    id: activity.calendarId,
    name: `Calendar ${activity.calendarId}`,
    group: 'Other',
  }
  const next = nextSession(sessions, today)
  return {
    ...activity,
    descriptionText: htmlToText(activity.description),
    center,
    calendar,
    facilities: activity.facilityIds
      .map((id) => index.facilityById.get(id)?.name)
      .filter((name): name is string => !!name),
    sessions,
    pageUrl: activityPageUrl(activity.id, site),
    link: activityDeepLink(activity, next ? dateOf(next.s) : today, site),
  }
}

export function buildSiteMeta(snapshot: Snapshot, version: string): SiteMeta {
  const enriched = snapshot.activities.filter((a) => a.ageText !== undefined).length
  return {
    generatedAt: snapshot.generatedAt,
    period: snapshot.period,
    counts: {
      calendars: snapshot.calendars.length,
      centers: snapshot.centers.length,
      activities: snapshot.activities.length,
      occurrences: snapshot.occurrences.length,
      enriched,
    },
    weeks: buildWeekShards(snapshot).map((w) => w.week),
    version,
  }
}
