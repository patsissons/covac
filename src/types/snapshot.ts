/**
 * The data model the scraper writes to `public/data/` (one pretty-printed file per collection plus
 * `snapshot.meta.json`, see `scripts/snapshot/files.ts`) and the app reads as the single minified
 * `snapshot.json` that the Vite build merges from them.
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
  /** Short price label for cards: `Free`, `$7.93`, or `from $112.00`. */
  priceText: string
  free: boolean
  /** Full fee table from the details endpoint, when published. */
  prices?: PriceLine[]
  // Optional fields from the per-activity details endpoint (enrichment may be partial).
  ageMin?: number
  ageMax?: number
  ageText?: string
  openings?: string
  firstDate?: string
  lastDate?: string
}

export interface PriceLine {
  /** `$182.00`, or a discount such as `50.00%`. */
  price: string
  description: string
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
