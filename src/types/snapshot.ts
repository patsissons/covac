/**
 * The data model the scraper writes to `public/data/snapshot.json` and the app reads.
 * Times are Vancouver local time with no timezone (the source has none); they are stored as
 * naive `YYYY-MM-DDTHH:mm` strings and rendered without conversion.
 */

export interface Snapshot {
  /** ISO timestamp of when the scrape ran. */
  generatedAt: string
  /** Date range covered by the source calendars (inclusive, YYYY-MM-DD). */
  period: { start: string; end: string }
  calendars: Calendar[]
  centers: Center[]
  facilities: Facility[]
  activities: Activity[]
  occurrences: Occurrence[]
}

export interface Calendar {
  id: number
  /** Display name with ActiveNet's leading `*` sort prefixes removed. */
  name: string
  /** Grouping derived from the name prefix before ":" (e.g. "Fitness"), or "Drop-in". */
  group: string
}

export interface Center {
  id: number
  name: string
  address?: string
  phone?: string
  lat?: number
  lng?: number
}

export interface Facility {
  id: number
  name: string
  centerId: number
}

export interface Activity {
  /** ActiveNet `event_item_id`, also the id used in the activity detail URL. */
  id: number
  title: string
  calendarId: number
  centerId: number
  facilityIds: number[]
  /** ActiveNet activity page for details and registration. */
  url: string
  /** Sanitized description HTML. */
  description: string
  instructors: string[]
  priceText: string
  free: boolean
  // Optional fields from the per-activity details endpoint (enrichment may be partial).
  ageMin?: number
  ageMax?: number
  ageText?: string
  openings?: string
  firstDate?: string
  lastDate?: string
}

/** One session of an activity. Short keys keep the 17k-row array small. */
export interface Occurrence {
  /** Activity id. */
  a: number
  /** Start, `YYYY-MM-DDTHH:mm`. */
  s: string
  /** End, `YYYY-MM-DDTHH:mm`. */
  e: string
}

export interface SnapshotMeta {
  generatedAt: string
  period: { start: string; end: string }
  counts: {
    calendars: number
    centers: number
    activities: number
    occurrences: number
    enriched: number
  }
}
