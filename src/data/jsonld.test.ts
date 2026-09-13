import { describe, expect, it } from 'vitest'
import { index, snapshot } from '@/test/fixture'
import { buildActivityDetail, buildSiteMeta, occurrencesByActivity } from './catalog'
import {
  datasetNode,
  eventNodes,
  jsonLdScript,
  placeNode,
  typicalAgeRange,
  webSiteNode,
} from './jsonld'

const sessions = occurrencesByActivity(snapshot.occurrences)

describe('placeNode', () => {
  it('maps address, geo and phone', () => {
    expect(placeNode(snapshot.centers[0]!)).toEqual({
      '@type': 'SportsActivityLocation',
      '@id': 'https://covac.fyi/centres/37/#place',
      name: 'Britannia Pool',
      url: 'https://covac.fyi/centres/37/',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '1661 Napier Street',
        addressLocality: 'Vancouver',
        addressRegion: 'BC',
        addressCountry: 'CA',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 49.2756, longitude: -123.0707 },
      telephone: '(604) 718-5831',
    })
    expect(placeNode(snapshot.centers[1]!)).not.toHaveProperty('address')
  })
})

describe('typicalAgeRange', () => {
  it('renders open-ended ranges', () => {
    expect(typicalAgeRange(5, 12)).toBe('5-12')
    expect(typicalAgeRange(19, 0)).toBe('19-')
    expect(typicalAgeRange(0, 12)).toBe('-12')
    expect(typicalAgeRange(0, 0)).toBeUndefined()
    expect(typicalAgeRange()).toBeUndefined()
  })
})

describe('eventNodes', () => {
  it('emits one offline scheduled Event per session with an offset', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[0]!,
      sessions.get(1)!,
      '2026-09-07',
    )
    const events = eventNodes(detail, detail.sessions)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      '@type': 'Event',
      name: 'Free Swim',
      description: 'Recreational swim for everyone.',
      startDate: '2026-09-07T07:00:00-07:00',
      endDate: '2026-09-07T08:00:00-07:00',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      isAccessibleForFree: true,
      url: 'https://covac.fyi/activities/1/',
      offers: { price: 0, priceCurrency: 'CAD', availability: 'https://schema.org/InStock' },
      performer: [{ '@type': 'Person', name: 'Ada Lovelace' }],
    })
    expect(events[0]!.location).toMatchObject({ name: 'Britannia Pool' })
    expect(events[0]).not.toHaveProperty('typicalAgeRange')
  })

  it('marks full activities sold out and omits offers without a price', () => {
    const full = { ...snapshot.activities[1]!, openings: 'Full' }
    const detail = buildActivityDetail(index, full, sessions.get(2)!, '2026-09-07')
    const [event] = eventNodes(detail, detail.sessions)
    expect(event!.offers).toMatchObject({ price: 5, availability: 'https://schema.org/SoldOut' })
    const unpriced = buildActivityDetail(
      index,
      { ...full, priceText: '', prices: undefined },
      sessions.get(2)!,
      '2026-09-07',
    )
    expect(eventNodes(unpriced, unpriced.sessions)[0]).not.toHaveProperty('offers')
  })
})

describe('site nodes', () => {
  it('describe the site and dataset', () => {
    expect(webSiteNode()).toMatchObject({ '@type': 'WebSite', url: 'https://covac.fyi/' })
    const dataset = datasetNode(buildSiteMeta(snapshot, '1'))
    expect(dataset).toMatchObject({
      '@type': 'Dataset',
      temporalCoverage: '2026-09-06/2026-11-01',
      dateModified: snapshot.generatedAt,
    })
    expect(dataset.description).toContain('2 activities and 3 sessions')
  })
})

describe('jsonLdScript', () => {
  it('wraps nodes in a graph and escapes closing tags', () => {
    const script = jsonLdScript({ '@type': 'Thing', name: 'a</script><b>' })
    expect(
      script.startsWith(
        '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[',
      ),
    ).toBe(true)
    expect(script).not.toContain('</script><b>')
    expect(script).toContain('\\u003c/script>')
    const json = script.slice(script.indexOf('>') + 1, -'</script>'.length)
    expect(JSON.parse(json)['@graph'][0].name).toBe('a</script><b>')
  })
})
