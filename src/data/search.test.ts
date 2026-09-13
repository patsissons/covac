import { describe, expect, it } from 'vitest'
import { index, snapshot } from '@/test/fixture'
import type { Snapshot } from '@/types/snapshot'
import { buildCatalog } from './catalog'
import { applyFilters, emptyFilters } from './filters'
import {
  buildSearchContext,
  filterOccurrences,
  fitsAge,
  groupSessions,
  matchesText,
  searchActivities,
  type SearchCriteria,
} from './search'

const extended: Snapshot = {
  ...snapshot,
  activities: [
    ...snapshot.activities,
    {
      id: 3,
      title: 'Adult Lengths',
      calendarId: 55,
      centerId: 37,
      facilityIds: [207],
      url: 'https://example.com/lengths/3',
      description: '<p>Lane swimming for confident swimmers.</p>',
      instructors: [],
      priceText: '$7.93',
      free: false,
      ageMin: 19,
      ageMax: 0,
      ageText: '19 yrs +',
    },
  ],
  occurrences: [
    ...snapshot.occurrences,
    { a: 3, s: '2026-09-09T06:00', e: '2026-09-09T07:30' },
    { a: 3, s: '2026-09-16T06:00', e: '2026-09-16T07:30' },
  ],
}
const catalog = buildCatalog(extended)
const ctx = buildSearchContext(catalog.activities, extended.centers, extended.calendars)
const week: SearchCriteria = { dateFrom: '2026-09-07', dateTo: '2026-09-13' }

describe('filterOccurrences', () => {
  it('matches applyFilters for one week with the shared criteria', () => {
    const filters = { ...emptyFilters('2026-09-07'), from: '12:00', centerIds: [37] }
    const expected = applyFilters(index, filters)
    const actual = filterOccurrences(snapshot.occurrences, ctx, {
      ...week,
      timeFrom: '12:00',
      centerIds: [37],
    })
    expect(actual).toEqual(expected)
  })

  it('spans weeks and honours the date range', () => {
    const all = filterOccurrences(extended.occurrences, ctx, {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    })
    expect(all).toHaveLength(5)
    expect(all.map((o) => o.s)).toEqual([...all.map((o) => o.s)].sort())
    const later = filterOccurrences(extended.occurrences, ctx, {
      dateFrom: '2026-09-14',
      dateTo: '2026-09-20',
    })
    expect(later.map((o) => o.a)).toEqual([3])
  })

  it('filters by group, days, price, free and age', () => {
    const drop = (c: Partial<SearchCriteria>) =>
      filterOccurrences(extended.occurrences, ctx, { ...week, ...c }).map((o) => o.a)
    expect(drop({ group: 'sports' })).toEqual([2])
    expect(drop({ days: [1] })).toEqual([1])
    expect(drop({ priceMax: 6 })).toEqual([1, 1, 2])
    expect(drop({ freeOnly: true })).toEqual([1, 1])
    // Basketball (2) is full; Adult Lengths (3) has no availability and is kept.
    expect(drop({ availableOnly: true })).toEqual([1, 1, 3])
    expect(drop({ age: 10 })).toEqual([1, 1, 2])
    expect(drop({ age: 30 })).toEqual([1, 1, 3, 2])
    expect(drop({ q: 'hastings' })).toEqual([2])
    expect(drop({ q: 'confident' })).toEqual([3])
  })
})

describe('fitsAge', () => {
  it('treats 0 as unbounded', () => {
    const adult = catalog.activities.find((a) => a.id === 3)!
    expect(fitsAge(adult, 18)).toBe(false)
    expect(fitsAge(adult, 19)).toBe(true)
    expect(fitsAge({ ...adult, ageMin: 5, ageMax: 12 }, 13)).toBe(false)
    expect(fitsAge({ ...adult, ageMin: undefined, ageMax: undefined }, 99)).toBe(true)
  })
})

describe('matchesText', () => {
  it('searches title, instructor, centre, calendar and blurb', () => {
    const swim = catalog.activities[0]!
    expect(matchesText(swim, ctx, 'FREE')).toBe(true)
    expect(matchesText(swim, ctx, 'lovelace')).toBe(true)
    expect(matchesText(swim, ctx, 'britannia')).toBe(true)
    expect(matchesText(swim, ctx, 'public swimming')).toBe(true)
    expect(matchesText(swim, ctx, 'recreational')).toBe(true)
    expect(matchesText(swim, ctx, 'hockey')).toBe(false)
    expect(matchesText(swim, ctx, '  ')).toBe(true)
  })
})

describe('searchActivities', () => {
  it('ranks title matches above centre and blurb matches', () => {
    expect(searchActivities(catalog.activities, ctx, 'swim').map((a) => a.id)).toEqual([1, 3])
    expect(searchActivities(catalog.activities, ctx, 'lengths').map((a) => a.id)).toEqual([3])
    expect(searchActivities(catalog.activities, ctx, 'nothing here')).toEqual([])
  })

  it('falls back to all words matching somewhere', () => {
    expect(searchActivities(catalog.activities, ctx, 'britannia lane').map((a) => a.id)).toEqual([
      3,
    ])
  })

  it('respects the limit', () => {
    expect(searchActivities(catalog.activities, ctx, 'swim', 1)).toHaveLength(1)
  })
})

describe('groupSessions', () => {
  it('collapses to one entry per activity in first-session order', () => {
    const groups = groupSessions(extended.occurrences, ctx.activityById)
    expect(groups.map((g) => [g.activity.id, g.sessions.length])).toEqual([
      [1, 2],
      [3, 2],
      [2, 1],
    ])
  })
})
