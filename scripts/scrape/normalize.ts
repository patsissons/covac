import sanitizeHtml from 'sanitize-html'
import type {
  FiltersBody,
  RawActivityDetail,
  RawCalendar,
  RawCenterEvents,
  RawEvent,
  RawInstructor,
} from './api'
import type {
  Activity,
  Calendar,
  Center,
  Facility,
  Occurrence,
  PriceLine,
  Snapshot,
} from '../../src/types/snapshot'

/** ActiveNet prefixes names with `*` / `**` to force sort order; strip them for display. */
export function cleanName(name: string): string {
  return name.replace(/^[*\s]+/, '').trim()
}

/** Titles like `|Free Swim|` use pipes as a drop-in marker; strip them. */
export function cleanTitle(title: string): string {
  return title.replace(/^[|\s]+|[|\s]+$/g, '').trim()
}

/** Group calendars by the prefix before ":", with the starred drop-in calendars grouped together. */
export function calendarGroup(rawName: string): string {
  if (rawName.startsWith('*')) return 'Drop-in'
  const colon = rawName.indexOf(':')
  if (colon > 0) return rawName.slice(0, colon).trim()
  if (/drop-in/i.test(rawName)) return 'Drop-in'
  return 'Other'
}

/** `YYYY-MM-DD HH:mm:ss` → `YYYY-MM-DDTHH:mm`. */
export function toLocalIso(raw: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(raw)
  if (!match) throw new Error(`Unexpected time format: ${raw}`)
  return `${match[1]}T${match[2]}`
}

/** `YYYY-MM-DD HH:mm:ss` → `YYYY-MM-DD`, or undefined for empty input. */
export function toLocalDate(raw: string | null | undefined): string | undefined {
  return raw ? raw.slice(0, 10) : undefined
}

const NO_INSTRUCTOR_ID = 21

export function instructorNames(instructors: RawInstructor[]): string[] {
  const names = instructors
    .filter((i) => i.id !== NO_INSTRUCTOR_ID && i.show_instructor_online)
    .map((i) => [i.first_name, i.middle_name, i.last_name].filter(Boolean).join(' ').trim())
    .filter((name) => name && !/^no instructor$/i.test(name))
  return [...new Set(names)]
}

/**
 * Reduce ActiveNet's Word-pasted description HTML to a small tag allowlist. The leading
 * "Date and Time / Session" table duplicates the occurrence data, so tables are dropped.
 */
export function sanitizeDescription(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    nonTextTags: ['style', 'script', 'textarea', 'option', 'table'],
  })
  return (
    clean
      // Collapse whitespace-only or <br>-only paragraphs that Word exports leave behind.
      .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/g, '')
      .replace(/(<br\s*\/?>\s*){2,}/g, '<br>')
      .replace(/\s+/g, ' ')
      .replace(/> </g, '><')
      .trim()
  )
}

export function priceText(price: RawEvent['price']): string {
  return (price.search_from_price_desc || price.estimate_price || '').trim()
}

const FREE_TEXT = /^(free|no charge|n\/c|\$0(\.00)?)$/i

/** Flatten the details endpoint's fee table into price lines, dropping empty entries. */
export function priceLines(price: RawEvent['price']): PriceLine[] {
  const lines: PriceLine[] = []
  for (const list of price.prices ?? []) {
    for (const detail of list.details) {
      const amount = detail.price.trim()
      if (!amount) continue
      const description = [list.list_name, detail.description].filter(Boolean).join(' – ').trim()
      lines.push({ price: amount, description })
    }
  }
  return lines
}

/**
 * Short label for cards. Uses the lowest dollar amount in the fee table (percent discounts
 * are ignored), prefixed with "from" when there is more than one distinct amount.
 */
export function summarizePrice(price: RawEvent['price'], lines: PriceLine[]): string {
  const direct = priceText(price)
  if (direct) return FREE_TEXT.test(direct) ? 'Free' : direct
  const amounts = [
    ...new Set(
      lines
        .map((l) => l.price)
        .filter((p) => p.startsWith('$'))
        .map((p) => Number(p.replace(/[^0-9.]/g, '')))
        .filter((n) => Number.isFinite(n)),
    ),
  ].sort((a, b) => a - b)
  if (amounts.length === 0) return price.free ? 'Free' : ''
  const lowest = amounts[0]!
  if (lowest === 0 && amounts.length === 1) return 'Free'
  const label = `$${lowest.toFixed(2)}`
  return amounts.length > 1 ? `from ${label}` : label
}

export interface CalendarScrape {
  calendar: RawCalendar
  filters: FiltersBody
  centerEvents: RawCenterEvents[]
}

export function isPublicCalendar(calendar: RawCalendar): boolean {
  return (
    !calendar.retired && !calendar.hide_on_internet && !/choose a calendar/i.test(calendar.name)
  )
}

/** Build a snapshot (without enrichment) from the bulk calendar, filter and event responses. */
export function buildSnapshot(scrapes: CalendarScrape[], generatedAt: string): Snapshot {
  const calendars: Calendar[] = []
  const centers = new Map<number, Center>()
  const facilities = new Map<number, Facility>()
  const activities = new Map<number, Activity>()
  const occurrences: Occurrence[] = []
  const seenOccurrence = new Set<string>()
  let start = ''
  let end = ''

  for (const { calendar, filters, centerEvents } of scrapes) {
    calendars.push({
      id: calendar.calendar_id,
      name: cleanName(calendar.name),
      group: calendarGroup(calendar.name),
    })
    const { start_date, end_date } = filters.calendar_period
    if (!start || start_date < start) start = start_date
    if (!end || end_date > end) end = end_date

    for (const center of filters.center) {
      if (!centers.has(center.id))
        centers.set(center.id, { id: center.id, name: cleanName(center.name) })
    }
    for (const f of filters.facilities)
      addFacility(facilities, f.facility_id, f.facility_name, f.center_id)

    for (const ce of centerEvents) {
      if (!centers.has(ce.center_id))
        centers.set(ce.center_id, { id: ce.center_id, name: cleanName(ce.center_name) })
      for (const event of ce.events) {
        for (const f of event.facilities)
          addFacility(facilities, f.facility_id, f.facility_name, f.center_id)
        if (!activities.has(event.event_item_id)) {
          activities.set(event.event_item_id, {
            id: event.event_item_id,
            title: cleanTitle(event.title),
            calendarId: calendar.calendar_id,
            centerId: ce.center_id,
            facilityIds: [...new Set(event.facilities.map((f) => f.facility_id))],
            url: event.activity_detail_url,
            description: sanitizeDescription(event.description),
            instructors: instructorNames(event.instructors),
            priceText: summarizePrice(event.price, []),
            free: event.price.free || FREE_TEXT.test(priceText(event.price)),
          })
        }
        const s = toLocalIso(event.start_time)
        const key = `${event.event_item_id}|${ce.center_id}|${s}`
        if (seenOccurrence.has(key)) continue
        seenOccurrence.add(key)
        occurrences.push({ a: event.event_item_id, s, e: toLocalIso(event.end_time) })
      }
    }
  }

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
  occurrences.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.a - b.a))

  return {
    generatedAt,
    period: { start, end },
    calendars: calendars.sort(byName),
    centers: [...centers.values()].sort(byName),
    facilities: [...facilities.values()].sort(byName),
    activities: [...activities.values()].sort((a, b) => a.id - b.id),
    occurrences,
  }
}

function addFacility(map: Map<number, Facility>, id: number, name: string, centerId: number) {
  if (!map.has(id)) map.set(id, { id, name: cleanName(name), centerId })
}

/** Merge per-activity detail responses into the snapshot. Returns the number of activities enriched. */
export function applyEnrichment(
  snapshot: Snapshot,
  details: ReadonlyMap<number, RawActivityDetail>,
): number {
  const centers = new Map(snapshot.centers.map((c) => [c.id, c]))
  let enriched = 0
  for (const activity of snapshot.activities) {
    const detail = details.get(activity.id)
    if (!detail) continue
    enriched++
    if (detail.age_min_year != null) activity.ageMin = detail.age_min_year
    if (detail.age_max_year != null) activity.ageMax = detail.age_max_year
    if (detail.age_description) activity.ageText = detail.age_description
    if (detail.space_status) activity.openings = detail.space_status
    const firstDate = toLocalDate(detail.first_date)
    const lastDate = toLocalDate(detail.last_date)
    if (firstDate) activity.firstDate = firstDate
    if (lastDate) activity.lastDate = lastDate
    if (detail.price) {
      const lines = priceLines(detail.price)
      if (lines.length) activity.prices = lines
      const summary = summarizePrice(detail.price, lines)
      if (summary) activity.priceText = summary
      activity.free = activity.free || detail.price.free || activity.priceText === 'Free'
    }
    for (const rawCenter of detail.centers) {
      const center = centers.get(rawCenter.id)
      if (!center) continue
      if (center.lat == null && rawCenter.latitude != null && rawCenter.longitude != null) {
        center.lat = rawCenter.latitude
        center.lng = rawCenter.longitude
      }
      if (!center.address && rawCenter.address1) {
        center.address = [rawCenter.address1, rawCenter.address2, rawCenter.city]
          .filter(Boolean)
          .join(', ')
      }
      if (!center.phone && rawCenter.phone) center.phone = rawCenter.phone
    }
  }
  return enriched
}
