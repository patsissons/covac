import { describe, expect, it } from 'vitest'
import { activityDeepLink, activityPageUrl, centrePageUrl, deepLink } from './links'
import { filtersFromSearch } from './url'

describe('page URLs', () => {
  it('point at the prerendered pages', () => {
    expect(activityPageUrl(389427)).toBe('https://covac.fyi/activities/389427/')
    expect(centrePageUrl(37, 'http://localhost:8788')).toBe('http://localhost:8788/centres/37/')
  })
})

describe('deepLink', () => {
  it('always spells out the week and snaps it to Monday', () => {
    expect(deepLink({ weekStart: '2026-09-16' })).toBe('https://covac.fyi/?week=2026-09-14')
  })

  it('round-trips through the app URL parser', () => {
    const url = new URL(
      deepLink({
        weekStart: '2026-09-14',
        centerIds: [37, 44],
        calendarIds: [55],
        q: 'swim',
        priceMax: 10,
      }),
    )
    const filters = filtersFromSearch(url.search, '2000-01-03')
    expect(filters.weekStart).toBe('2026-09-14')
    expect(filters.centerIds).toEqual([37, 44])
    expect(filters.calendarIds).toEqual([55])
    expect(filters.q).toBe('swim')
    expect(filters.priceMax).toBe(10)
  })
})

describe('activityDeepLink', () => {
  it('shows the centre in the week of the session, filtered to the title', () => {
    const url = activityDeepLink({ id: 1, title: 'Free Swim', centerId: 37 }, '2026-09-19')
    expect(url).toBe('https://covac.fyi/?week=2026-09-14&centers=37&q=Free+Swim&activity=1')
    const parsed = filtersFromSearch(new URL(url).search, '2000-01-03')
    expect(parsed.activity).toBe(1)
  })
})
