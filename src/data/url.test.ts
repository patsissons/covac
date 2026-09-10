import { describe, expect, it } from 'vitest'
import { emptyFilters } from './filters'
import { filtersFromSearch, filtersToSearch } from './url'

const defaultWeek = '2026-09-07'

describe('url filters', () => {
  it('round-trips a full set of filters', () => {
    const filters = {
      weekStart: '2026-09-14',
      calendarIds: [55, 3],
      centerIds: [37],
      from: '12:00',
      to: '18:00',
      days: [6, 0],
      q: 'swim',
    }
    const search = filtersToSearch(filters, defaultWeek)
    expect(search).toBe(
      '?week=2026-09-14&cal=55%2C3&centers=37&from=12%3A00&to=18%3A00&days=6%2C0&q=swim',
    )
    expect(filtersFromSearch(search, defaultWeek)).toEqual(filters)
  })

  it('omits defaults and ignores invalid values', () => {
    expect(filtersToSearch(emptyFilters(defaultWeek), defaultWeek)).toBe('')
    const parsed = filtersFromSearch('?week=nope&from=25&days=9,3&cal=x,55', defaultWeek)
    expect(parsed.weekStart).toBe(defaultWeek)
    expect(parsed.from).toBe('')
    expect(parsed.days).toEqual([3])
    expect(parsed.calendarIds).toEqual([55])
  })

  it('snaps an arbitrary week date to Monday', () => {
    expect(filtersFromSearch('?week=2026-09-16', defaultWeek).weekStart).toBe('2026-09-14')
  })
})
