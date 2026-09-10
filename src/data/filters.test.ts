import { describe, expect, it } from 'vitest'
import type { Snapshot } from '@/types/snapshot'
import { applyFilters, emptyFilters, groupByCenterAndDay, hasActiveFilters } from './filters'
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
