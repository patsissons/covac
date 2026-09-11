import { describe, expect, it } from 'vitest'
import type { Snapshot } from '@/types/snapshot'
import {
  applyFilters,
  emptyFilters,
  groupByCenterAndDay,
  groupByHourAndDay,
  groupSelection,
  toggleCalendarGroup,
  hasActiveFilters,
  visibleCenterIds,
} from './filters'
import { buildIndex } from './index'

const snapshot: Snapshot = {
  generatedAt: '2026-09-09T00:00:00.000Z',
  period: { start: '2026-09-06', end: '2026-11-01' },
  calendars: [
    { id: 55, name: 'Public Swimming', group: 'Drop-in' },
    { id: 10, name: 'Sports: Basketball', group: 'Sports' },
  ],
  centers: [
    { id: 37, name: 'Britannia Pool' },
    { id: 44, name: 'Hastings Community Centre' },
  ],
  facilities: [],
  activities: [
    {
      id: 1,
      title: 'Free Swim',
      calendarId: 55,
      centerId: 37,
      facilityIds: [],
      url: '',
      description: '',
      instructors: ['Ada Lovelace'],
      priceText: '',
      free: true,
    },
    {
      id: 2,
      title: 'Basketball Drop-in',
      calendarId: 10,
      centerId: 44,
      facilityIds: [],
      url: '',
      description: '',
      instructors: [],
      priceText: 'from $5.00',
      free: false,
    },
    {
      id: 3,
      title: 'Mystery Class',
      calendarId: 10,
      centerId: 44,
      facilityIds: [],
      url: '',
      description: '',
      instructors: [],
      priceText: '',
      free: false,
    },
  ],
  occurrences: [
    { a: 1, s: '2026-09-07T07:00', e: '2026-09-07T08:00' }, // Mon early
    { a: 1, s: '2026-09-08T14:00', e: '2026-09-08T16:00' }, // Tue
    { a: 2, s: '2026-09-12T18:00', e: '2026-09-12T20:00' }, // Sat
    { a: 2, s: '2026-09-15T18:00', e: '2026-09-15T20:00' }, // next week
  ],
}
const index = buildIndex(snapshot)
const week = '2026-09-07'

describe('buildIndex', () => {
  it('buckets occurrences by day and orders groups with Drop-in first', () => {
    expect(index.byDay.get('2026-09-07')).toHaveLength(1)
    expect(index.byDay.get('2026-09-15')).toHaveLength(1)
    expect(index.groups).toEqual(['Drop-in', 'Sports'])
  })

  it('records each known price and tops the slider at the priciest one', () => {
    expect([...index.priceById]).toEqual([
      [1, 0],
      [2, 5],
    ])
    expect(index.priceCeiling).toBe(5)
  })
})

describe('applyFilters', () => {
  it('returns only the selected week when no filters are active', () => {
    const filters = emptyFilters(week)
    expect(hasActiveFilters(filters)).toBe(false)
    expect(applyFilters(index, filters).map((o) => o.s)).toEqual([
      '2026-09-07T07:00',
      '2026-09-08T14:00',
      '2026-09-12T18:00',
    ])
  })

  it('filters by calendar and centre', () => {
    expect(applyFilters(index, { ...emptyFilters(week), calendarIds: [10] })).toHaveLength(1)
    expect(applyFilters(index, { ...emptyFilters(week), centerIds: [37] })).toHaveLength(2)
    expect(
      applyFilters(index, { ...emptyFilters(week), centerIds: [37], calendarIds: [10] }),
    ).toHaveLength(0)
  })

  it('filters by start time window', () => {
    expect(applyFilters(index, { ...emptyFilters(week), from: '12:00' })).toHaveLength(2)
    expect(applyFilters(index, { ...emptyFilters(week), to: '12:00' })).toHaveLength(1)
    expect(applyFilters(index, { ...emptyFilters(week), from: '13:00', to: '15:00' })).toHaveLength(
      1,
    )
  })

  it('filters by day of week', () => {
    expect(applyFilters(index, { ...emptyFilters(week), days: [6, 0] })).toHaveLength(1)
  })

  it('filters by price and drops unpriced activities once a bound is set', () => {
    // Activity 3 has no known price and one Sunday session this week.
    const priced = buildIndex({
      ...snapshot,
      occurrences: [
        ...snapshot.occurrences,
        { a: 3, s: '2026-09-13T10:00', e: '2026-09-13T11:00' },
      ],
    })
    const base = emptyFilters(week)
    expect(applyFilters(priced, base)).toHaveLength(4)
    expect(applyFilters(priced, { ...base, priceMax: 0 })).toHaveLength(2)
    expect(applyFilters(priced, { ...base, priceMin: 1 })).toHaveLength(1)
    expect(applyFilters(priced, { ...base, priceMin: 6 })).toHaveLength(0)
    expect(applyFilters(priced, { ...base, priceMin: 0, priceMax: 5 })).toHaveLength(3)
    expect(hasActiveFilters({ ...base, priceMax: 0 })).toBe(true)
  })

  it('searches title and instructor case-insensitively', () => {
    expect(applyFilters(index, { ...emptyFilters(week), q: 'SWIM' })).toHaveLength(2)
    expect(applyFilters(index, { ...emptyFilters(week), q: 'lovelace' })).toHaveLength(2)
    expect(applyFilters(index, { ...emptyFilters(week), q: 'zzz' })).toHaveLength(0)
  })
})

describe('groupByCenterAndDay', () => {
  it('groups by centre then day', () => {
    const grid = groupByCenterAndDay(index, applyFilters(index, emptyFilters(week)))
    expect([...grid.keys()]).toEqual([37, 44])
    expect(grid.get(37)?.get('2026-09-07')).toHaveLength(1)
    expect(grid.get(37)?.get('2026-09-08')).toHaveLength(1)
    expect(grid.get(44)?.get('2026-09-12')).toHaveLength(1)
  })
})

describe('groupByHourAndDay', () => {
  it('groups by start hour then day across centres', () => {
    const occurrences = applyFilters(index, emptyFilters(week))
    const grid = groupByHourAndDay(occurrences)
    expect([...grid.keys()].sort((a, b) => a - b)).toEqual([7, 14, 18])
    expect(grid.get(7)?.get('2026-09-07')).toHaveLength(1)
    expect(grid.get(18)?.get('2026-09-12')?.[0]?.a).toBe(2)
  })
})

describe('visibleCenterIds', () => {
  it('lists centres with sessions sorted by name', () => {
    expect(visibleCenterIds(index, applyFilters(index, emptyFilters(week)))).toEqual([37, 44])
    expect(visibleCenterIds(index, [])).toEqual([])
  })
})

describe('toggleCalendarGroup', () => {
  it('adds the whole group, then removes it, leaving other selections alone', () => {
    const withDropIn = toggleCalendarGroup(index, [10], 'Drop-in')
    expect(withDropIn).toEqual([10, 55])
    expect(groupSelection(index, withDropIn, 'Drop-in')).toBe('all')
    expect(toggleCalendarGroup(index, withDropIn, 'Drop-in')).toEqual([10])
    expect(groupSelection(index, [], 'Sports')).toBe('none')
  })
})
