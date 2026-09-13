/**
 * Multi-week search and filtering over catalog shards. Shares its semantics with the app's
 * `applyFilters` (start-time window, day of week, calendar, centre, price) and adds the things an
 * agent asks for: a date range, an age, free-only, and text matching beyond the title.
 */
import type { Calendar, Center, Occurrence } from '@/types/snapshot'
import type { CatalogActivity } from './catalog'
import { dateOf, dayOfWeek, timeOf, toMinutes, type DateString } from './dates'
import { matchesQuery } from './filters'

export interface SearchContext {
  activityById: Map<number, CatalogActivity>
  centerById: Map<number, Center>
  calendarById: Map<number, Calendar>
}

export interface SearchCriteria {
  /** Case-insensitive text over title, instructors, centre, calendar and description blurb. */
  q?: string
  /** Calendar group name such as `Drop-in`, `Fitness`, `Sports`, `Art & Culture`. */
  group?: string
  calendarIds?: number[]
  centerIds?: number[]
  /** Inclusive date range of sessions to include. */
  dateFrom: DateString
  dateTo: DateString
  /** Days of week (0 = Sunday). */
  days?: number[]
  /** Earliest / latest session start, `HH:mm`. */
  timeFrom?: string
  timeTo?: string
  /** Highest price in dollars; activities with an unknown price are excluded when set. */
  priceMax?: number
  freeOnly?: boolean
  /** Participant age; activities whose known range excludes it are dropped. */
  age?: number
}

export function buildSearchContext(
  activities: CatalogActivity[],
  centres: Center[],
  calendars: Calendar[],
): SearchContext {
  return {
    activityById: new Map(activities.map((a) => [a.id, a])),
    centerById: new Map(centres.map((c) => [c.id, c])),
    calendarById: new Map(calendars.map((c) => [c.id, c])),
  }
}

/** Age fits the activity's known range; 0 means unbounded on that side, as in ActiveNet. */
export function fitsAge(activity: CatalogActivity, age: number): boolean {
  const min = activity.ageMin ?? 0
  const max = activity.ageMax ?? 0
  return (min === 0 || age >= min) && (max === 0 || age <= max)
}

/** Text match over title/instructors first, then centre name, calendar name and blurb. */
export function matchesText(activity: CatalogActivity, ctx: SearchContext, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (matchesQuery(activity.title, activity.instructors ?? [], needle)) return true
  if (ctx.centerById.get(activity.centerId)?.name.toLowerCase().includes(needle)) return true
  if (ctx.calendarById.get(activity.calendarId)?.name.toLowerCase().includes(needle)) return true
  return activity.blurb?.toLowerCase().includes(needle) ?? false
}

/** Every criterion that does not depend on a session's date or time. */
export function matchesActivity(
  activity: CatalogActivity,
  ctx: SearchContext,
  c: SearchCriteria,
): boolean {
  if (c.calendarIds?.length && !c.calendarIds.includes(activity.calendarId)) return false
  if (c.centerIds?.length && !c.centerIds.includes(activity.centerId)) return false
  if (c.group) {
    const group = ctx.calendarById.get(activity.calendarId)?.group
    if (group?.toLowerCase() !== c.group.trim().toLowerCase()) return false
  }
  if (c.freeOnly && !activity.free && activity.price !== 0) return false
  if (c.priceMax !== undefined) {
    if (activity.price === undefined || activity.price > c.priceMax) return false
  }
  if (c.age !== undefined && !fitsAge(activity, c.age)) return false
  if (c.q && !matchesText(activity, ctx, c.q)) return false
  return true
}

/** Sessions in the date range whose activity and start time satisfy every criterion. */
export function filterOccurrences(
  occurrences: Occurrence[],
  ctx: SearchContext,
  c: SearchCriteria,
): Occurrence[] {
  const days = new Set(c.days ?? [])
  const from = c.timeFrom ? toMinutes(c.timeFrom) : -1
  const to = c.timeTo ? toMinutes(c.timeTo) : Infinity
  const verdicts = new Map<number, boolean>()
  const result: Occurrence[] = []
  for (const occurrence of occurrences) {
    const day = dateOf(occurrence.s)
    if (day < c.dateFrom || day > c.dateTo) continue
    if (days.size && !days.has(dayOfWeek(day))) continue
    const start = toMinutes(timeOf(occurrence.s))
    if (start < from || start > to) continue
    let ok = verdicts.get(occurrence.a)
    if (ok === undefined) {
      const activity = ctx.activityById.get(occurrence.a)
      ok = !!activity && matchesActivity(activity, ctx, c)
      verdicts.set(occurrence.a, ok)
    }
    if (ok) result.push(occurrence)
  }
  return result.sort((a, b) => a.s.localeCompare(b.s))
}

export interface ActivitySessions {
  activity: CatalogActivity
  sessions: Occurrence[]
}

/** Collapse sessions to one entry per activity, ordered by each activity's first session. */
export function groupSessions(
  occurrences: Occurrence[],
  activityById: Map<number, CatalogActivity>,
): ActivitySessions[] {
  const groups = new Map<number, ActivitySessions>()
  for (const occurrence of occurrences) {
    const group = groups.get(occurrence.a)
    if (group) group.sessions.push(occurrence)
    else {
      const activity = activityById.get(occurrence.a)
      if (activity) groups.set(occurrence.a, { activity, sessions: [occurrence] })
    }
  }
  return [...groups.values()].sort((a, b) => a.sessions[0]!.s.localeCompare(b.sessions[0]!.s))
}

/** Relevance of an activity for a free-text query; 0 means no match. */
export function scoreMatch(activity: CatalogActivity, ctx: SearchContext, q: string): number {
  const needle = q.trim().toLowerCase()
  if (!needle) return 1
  const title = activity.title.toLowerCase()
  if (title === needle) return 100
  if (title.startsWith(needle)) return 80
  if (title.includes(needle)) return 60
  if ((activity.instructors ?? []).some((name) => name.toLowerCase().includes(needle))) return 40
  if (ctx.centerById.get(activity.centerId)?.name.toLowerCase().includes(needle)) return 30
  if (ctx.calendarById.get(activity.calendarId)?.name.toLowerCase().includes(needle)) return 20
  if (activity.blurb?.toLowerCase().includes(needle)) return 10
  return 0
}

/** Ranked free-text search; ties break on the earliest upcoming session, then title. */
export function searchActivities(
  activities: CatalogActivity[],
  ctx: SearchContext,
  q: string,
  limit = 20,
): CatalogActivity[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const scored: { activity: CatalogActivity; score: number }[] = []
  for (const activity of activities) {
    let score = scoreMatch(activity, ctx, q)
    if (score === 0 && words.length > 1) {
      // Fall back to every word matching somewhere, scored by the weakest word.
      const per = words.map((word) => scoreMatch(activity, ctx, word))
      score = per.every((s) => s > 0) ? Math.min(...per) / 2 : 0
    }
    if (score > 0) scored.push({ activity, score })
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.activity.first ?? '9').localeCompare(b.activity.first ?? '9') ||
      a.activity.title.localeCompare(b.activity.title),
  )
  return scored.slice(0, limit).map((s) => s.activity)
}
