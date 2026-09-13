import { describe, expect, it } from 'vitest'
import { index, snapshot } from '@/test/fixture'
import { buildActivityDetail, buildCatalog, occurrencesByActivity } from './catalog'
import { activityLine, activityMarkdown, priceLabel, sessionLines } from './markdown'

const catalog = buildCatalog(snapshot)
const sessions = occurrencesByActivity(snapshot.occurrences)

describe('priceLabel', () => {
  it('prefers Free, then the label, then the numeric price', () => {
    expect(priceLabel({ priceText: '', free: true })).toBe('Free')
    expect(priceLabel({ priceText: 'from $5.00', free: false, price: 5 })).toBe('from $5.00')
    expect(priceLabel({ priceText: '', free: false, price: 7.93 })).toBe('$7.93')
    expect(priceLabel({ priceText: '', free: false })).toBe('Price not listed')
  })
})

describe('sessionLines', () => {
  it('groups by day and truncates', () => {
    expect(sessionLines(sessions.get(1)!)).toEqual([
      '- Mon Sep 7: 7:00 am – 8:00 am',
      '- Tue Sep 8: 2:00 pm – 4:00 pm',
    ])
    expect(sessionLines(sessions.get(1)!, 1)).toEqual([
      '- Mon Sep 7: 7:00 am – 8:00 am',
      '- … 1 more day',
    ])
  })
})

describe('activityLine', () => {
  it('summarises an activity with its link', () => {
    const swim = catalog.activities[0]!
    expect(activityLine(swim, index.centerById.get(37), index.calendarById.get(55))).toBe(
      '- [Free Swim](https://covac.fyi/activities/1/) · Britannia Pool · Public Swimming · Free · All ages · 2 sessions, next Mon Sep 7 7:00 am · with Ada Lovelace',
    )
  })
})

describe('activityMarkdown', () => {
  it('renders facts, description, fees, sessions and links', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[1]!,
      sessions.get(2)!,
      '2026-09-08',
    )
    const md = activityMarkdown(detail, '2026-09-08')
    expect(md).toContain('# Basketball Drop-in')
    expect(md).toContain('- Centre: Hastings Community Centre')
    expect(md).toContain('- Calendar: Sports: Basketball (Sports)')
    expect(md).toContain('- Price: from $5.00')
    expect(md).toContain('## Fees\n- $5.00: Drop-in\n- $40.00: 10 visit pass')
    expect(md).toContain('## Upcoming sessions (Vancouver time)\n- Sat Sep 12: 6:00 pm – 8:00 pm')
    expect(md).toContain('https://example.com/basketball/2')
    expect(md).toContain('https://covac.fyi/activities/2/')
  })

  it('says when nothing is upcoming', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[0]!,
      sessions.get(1)!,
      '2026-12-01',
    )
    expect(activityMarkdown(detail, '2026-12-01')).toContain('No sessions on or after today')
    expect(activityMarkdown(detail)).toContain('## Sessions (Vancouver time)\n- Mon Sep 7')
  })
})
