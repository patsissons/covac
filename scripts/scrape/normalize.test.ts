import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  ActivityDetailBody,
  ApiEnvelope,
  CalendarsBody,
  EventsBody,
  FiltersBody,
  RawPrice,
} from './api'
import {
  applyEnrichment,
  buildSnapshot,
  calendarGroup,
  cleanName,
  cleanTitle,
  instructorNames,
  isPublicCalendar,
  priceLines,
  summarizePrice,
  sanitizeDescription,
  toLocalIso,
} from './normalize'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, '__fixtures__', name), 'utf8')) as T

const calendars = fixture<ApiEnvelope<CalendarsBody>>('calendars.json').body.calendars
const filters = fixture<ApiEnvelope<FiltersBody>>('filters-55.json').body
const events = fixture<ApiEnvelope<EventsBody>>('events-55.json').body.center_events
const detail = fixture<ApiEnvelope<ActivityDetailBody>>('activity-details-526347.json').body
  .activity_detail
const swimming = calendars.find((c) => c.calendar_id === 55)!

describe('cleanName', () => {
  it('strips ActiveNet sort prefixes', () => {
    expect(cleanName('**Public Swimming')).toBe('Public Swimming')
    expect(cleanName('*Britannia Pool')).toBe('Britannia Pool')
    expect(cleanName('Sports: Soccer')).toBe('Sports: Soccer')
  })
})

describe('cleanTitle', () => {
  it('strips surrounding pipes', () => {
    expect(cleanTitle('|Free Swim|')).toBe('Free Swim')
    expect(cleanTitle('Aquafit - Shallow Moderate')).toBe('Aquafit - Shallow Moderate')
  })
})

describe('calendarGroup', () => {
  it('groups by prefix and treats starred calendars as drop-in', () => {
    expect(calendarGroup('**Public Swimming')).toBe('Drop-in')
    expect(calendarGroup('Fitness: Yoga & Pilates')).toBe('Fitness')
    expect(calendarGroup('Art & Culture: Pottery & Woodworking')).toBe('Art & Culture')
    expect(calendarGroup('Various/Other Drop-in Activities')).toBe('Drop-in')
    expect(calendarGroup('Queer Inclusion')).toBe('Other')
  })
})

describe('toLocalIso', () => {
  it('converts the raw timestamp and drops seconds', () => {
    expect(toLocalIso('2026-09-08 14:00:00')).toBe('2026-09-08T14:00')
  })
  it('rejects unexpected formats', () => {
    expect(() => toLocalIso('2026/09/08')).toThrow()
  })
})

describe('instructorNames', () => {
  it('drops the "No Instructor" placeholder and hidden instructors', () => {
    const names = instructorNames([
      {
        id: 21,
        first_name: 'No',
        middle_name: '',
        last_name: 'Instructor',
        is_primary_instructor: true,
        show_instructor_online: true,
      },
      {
        id: 2,
        first_name: 'Ada',
        middle_name: '',
        last_name: 'Lovelace',
        is_primary_instructor: false,
        show_instructor_online: true,
      },
      {
        id: 3,
        first_name: 'Hidden',
        middle_name: '',
        last_name: 'Person',
        is_primary_instructor: false,
        show_instructor_online: false,
      },
    ])
    expect(names).toEqual(['Ada Lovelace'])
  })
})

describe('sanitizeDescription', () => {
  it('drops the date table, font tags and empty paragraphs but keeps text', () => {
    const html =
      '<p><span><table><tr><td>Date and Time</td><td>Tue 2pm</td></tr></table></span></p>' +
      '<p style="margin:0"><br></p><p><font face="Arial">Free Swim<br></font></p>' +
      '<p>Recreational swim for <b>Children</b>.</p><p>&nbsp;</p>'
    expect(sanitizeDescription(html)).toBe(
      '<p>Free Swim<br /></p><p>Recreational swim for <b>Children</b>.</p>',
    )
  })
  it('keeps safe links only', () => {
    expect(
      sanitizeDescription('<a href="javascript:alert(1)">x</a><a href="https://a.b">y</a>'),
    ).toBe('<a>x</a><a href="https://a.b">y</a>')
  })
})

describe('isPublicCalendar', () => {
  it('excludes the placeholder calendar', () => {
    expect(calendars.filter(isPublicCalendar).map((c) => c.calendar_id)).not.toContain(23)
    expect(isPublicCalendar(swimming)).toBe(true)
  })
})

describe('buildSnapshot', () => {
  const snapshot = buildSnapshot(
    [{ calendar: swimming, filters, centerEvents: events }],
    '2026-09-09T00:00:00.000Z',
  )

  it('records the period and calendar', () => {
    expect(snapshot.period).toEqual({ start: '2026-09-06', end: '2026-11-01' })
    expect(snapshot.calendars).toEqual([{ id: 55, name: 'Public Swimming', group: 'Drop-in' }])
  })

  it('collects every centre and facility from filters with clean names', () => {
    expect(snapshot.centers).toHaveLength(filters.center.length)
    expect(snapshot.centers.every((c) => !c.name.startsWith('*'))).toBe(true)
    expect(snapshot.facilities.find((f) => f.id === 207)).toEqual({
      id: 207,
      name: 'Britannia Pool',
      centerId: 37,
    })
  })

  it('dedupes activities by event_item_id and keeps one occurrence per session', () => {
    const rawEvents = events.flatMap((c) => c.events)
    const ids = new Set(rawEvents.map((e) => e.event_item_id))
    expect(snapshot.activities).toHaveLength(ids.size)
    expect(snapshot.occurrences).toHaveLength(rawEvents.length)
    const freeSwim = snapshot.activities.find((a) => a.id === 526347)!
    expect(freeSwim.title).toBe('Free Swim')
    expect(freeSwim.centerId).toBe(37)
    expect(freeSwim.facilityIds).toEqual([207])
    expect(freeSwim.calendarId).toBe(55)
    expect(freeSwim.description).not.toContain('<table')
    expect(freeSwim.description).toContain('Recreational swim')
  })

  it('sorts occurrences by start time', () => {
    const starts = snapshot.occurrences.map((o) => o.s)
    expect(starts).toEqual([...starts].sort())
    expect(starts[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('is deterministic for the same input', () => {
    const again = buildSnapshot(
      [{ calendar: swimming, filters, centerEvents: events }],
      '2026-09-09T00:00:00.000Z',
    )
    expect(again).toEqual(snapshot)
  })
})

describe('applyEnrichment', () => {
  it('adds age, openings, dates and centre coordinates', () => {
    const snapshot = buildSnapshot(
      [{ calendar: swimming, filters, centerEvents: events }],
      '2026-09-09T00:00:00.000Z',
    )
    const enriched = applyEnrichment(snapshot, new Map([[526347, detail]]))
    expect(enriched).toBe(1)
    const freeSwim = snapshot.activities.find((a) => a.id === 526347)!
    expect(freeSwim.ageMin).toBe(13)
    expect(freeSwim.ageMax).toBe(18)
    expect(freeSwim.ageText).toBe('Age at least 13 yrs but less than 18y 11m')
    expect(freeSwim.openings).toBe('100 openings remaining')
    expect(freeSwim.firstDate).toBe('2026-09-01')
    expect(freeSwim.lastDate).toBe('2026-11-10')
    const britannia = snapshot.centers.find((c) => c.id === 37)!
    expect(britannia.lat).toBeCloseTo(49.2756)
    expect(britannia.lng).toBeCloseTo(-123.0707)
    expect(britannia.address).toBe('1661 Napier Street, Vancouver')
    expect(britannia.phone).toBe('(604) 718-5831')
  })

  it('leaves activities without details untouched', () => {
    const snapshot = buildSnapshot(
      [{ calendar: swimming, filters, centerEvents: events }],
      '2026-09-09T00:00:00.000Z',
    )
    expect(applyEnrichment(snapshot, new Map())).toBe(0)
    expect(snapshot.activities.every((a) => a.ageText === undefined)).toBe(true)
  })
})

const price = (overrides: Partial<RawPrice>): RawPrice => ({
  search_from_price_desc: '',
  estimate_price: '',
  free: false,
  ...overrides,
})

describe('price helpers', () => {
  const table: RawPrice['prices'] = [
    {
      list_name: '',
      activity_name: 'Badminton',
      details: [
        { price: '$112.00', description: 'Standard charge' },
        { price: '50.00%', description: 'Leisure Access' },
        { price: '$182.00', description: 'Non-resident' },
        { price: '', description: 'blank' },
      ],
    },
  ]

  it('flattens fee tables and drops blank rows', () => {
    expect(priceLines(price({ prices: table }))).toEqual([
      { price: '$112.00', description: 'Standard charge' },
      { price: '50.00%', description: 'Leisure Access' },
      { price: '$182.00', description: 'Non-resident' },
    ])
    expect(priceLines(price({}))).toEqual([])
  })

  it('summarizes with the lowest dollar amount and a from prefix', () => {
    const lines = priceLines(price({ prices: table }))
    expect(summarizePrice(price({ prices: table }), lines)).toBe('from $112.00')
    expect(summarizePrice(price({}), [{ price: '$7.93', description: 'Drop-in' }])).toBe('$7.93')
    expect(summarizePrice(price({}), [{ price: '$0.00', description: 'x' }])).toBe('Free')
  })

  it('prefers the direct price text and normalizes free wording', () => {
    expect(summarizePrice(price({ search_from_price_desc: '$14.29' }), [])).toBe('$14.29')
    expect(summarizePrice(price({ estimate_price: 'no charge' }), [])).toBe('Free')
    expect(summarizePrice(price({ free: true }), [])).toBe('Free')
    expect(summarizePrice(price({}), [])).toBe('')
  })

  it('applies enrichment prices to activities', () => {
    const snapshot = buildSnapshot(
      [{ calendar: swimming, filters, centerEvents: events }],
      '2026-09-09T00:00:00.000Z',
    )
    const priced = { ...detail, price: price({ show_price_info_online: true, prices: table }) }
    applyEnrichment(snapshot, new Map([[526347, priced]]))
    const freeSwim = snapshot.activities.find((a) => a.id === 526347)!
    expect(freeSwim.priceText).toBe('from $112.00')
    expect(freeSwim.prices).toHaveLength(3)
    expect(freeSwim.free).toBe(false)
  })
})
