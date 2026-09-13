/**
 * schema.org JSON-LD builders for the prerendered pages and the app shell. Pure object builders;
 * `jsonLdScript` serialises them safely for embedding in HTML.
 */
import type { Center, Occurrence } from '@/types/snapshot'
import { isAvailable } from './availability'
import type { ActivityDetail, SiteMeta } from './catalog'
import { dateOf } from './dates'
import { activityPageUrl, centrePageUrl, SITE_URL } from './links'
import { activityPrice } from './prices'
import { blurb } from './text'
import { toOffsetIso } from './tz'

export type JsonLd = Record<string, unknown>

export const ORGANIZER: JsonLd = {
  '@type': 'Organization',
  name: 'Vancouver Board of Parks and Recreation',
  url: 'https://vancouver.ca/parks-recreation-culture.aspx',
}

/** A recreation centre, pool or rink as a Place. */
export function placeNode(center: Center, site = SITE_URL): JsonLd {
  const node: JsonLd = {
    '@type': 'SportsActivityLocation',
    '@id': `${centrePageUrl(center.id, site)}#place`,
    name: center.name,
    url: centrePageUrl(center.id, site),
  }
  if (center.address) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: center.address.replace(/,\s*Vancouver$/i, ''),
      addressLocality: 'Vancouver',
      addressRegion: 'BC',
      addressCountry: 'CA',
    }
  }
  if (center.lat !== undefined && center.lng !== undefined) {
    node.geo = { '@type': 'GeoCoordinates', latitude: center.lat, longitude: center.lng }
  }
  if (center.phone) node.telephone = center.phone
  return node
}

/** `5-12`, `19-` or undefined; ActiveNet uses 0 for an open end. */
export function typicalAgeRange(ageMin?: number, ageMax?: number): string | undefined {
  const min = ageMin ?? 0
  const max = ageMax ?? 0
  if (!min && !max) return undefined
  return `${min || ''}-${max || ''}`
}

/** One Event per session, the shape Google's event rich results expect. */
export function eventNodes(
  detail: ActivityDetail,
  sessions: Occurrence[],
  site = SITE_URL,
): JsonLd[] {
  const place = placeNode(detail.center, site)
  const price = activityPrice(detail)
  const description = blurb(detail.descriptionText || detail.title, 500)
  const soldOut = !isAvailable(detail)
  const cancelled = detail.availability === 'cancelled'
  const ageRange = typicalAgeRange(detail.ageMin, detail.ageMax)
  return sessions.map((session) => {
    const node: JsonLd = {
      '@type': 'Event',
      name: detail.title,
      description,
      startDate: toOffsetIso(session.s),
      endDate: toOffsetIso(session.e),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: cancelled
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
      location: place,
      organizer: ORGANIZER,
      url: activityPageUrl(detail.id, site),
      image: `${site}/og.png`,
      isAccessibleForFree: price === 0,
    }
    if (price !== undefined) {
      node.offers = {
        '@type': 'Offer',
        price,
        priceCurrency: 'CAD',
        url: detail.url,
        availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        validFrom: dateOf(session.s),
      }
    }
    if (ageRange) node.typicalAgeRange = ageRange
    if (detail.instructors.length) {
      node.performer = detail.instructors.map((name) => ({ '@type': 'Person', name }))
    }
    return node
  })
}

export function breadcrumbNode(items: { name: string; url: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function webSiteNode(site = SITE_URL): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    name: 'covac',
    alternateName: 'City of Vancouver Active Communities',
    url: `${site}/`,
    description:
      'A week-grid calendar of City of Vancouver recreation activities: every recreation centre, one week at a time.',
    inLanguage: 'en-CA',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function datasetNode(meta: SiteMeta, site = SITE_URL): JsonLd {
  return {
    '@type': 'Dataset',
    '@id': `${site}/#dataset`,
    name: 'City of Vancouver recreation activities (covac snapshot)',
    description: `Drop-in activities and registered programs at ${meta.counts.centers} City of Vancouver recreation centres, pools and rinks: ${meta.counts.activities} activities and ${meta.counts.occurrences} sessions between ${meta.period.start} and ${meta.period.end}, scraped nightly from ActiveNet. Unofficial mirror; confirm and register on ActiveNet.`,
    url: `${site}/`,
    sameAs: 'https://anc.ca.apm.activecommunities.com/vancouver/calendars',
    creator: ORGANIZER,
    isAccessibleForFree: true,
    inLanguage: 'en-CA',
    temporalCoverage: `${meta.period.start}/${meta.period.end}`,
    spatialCoverage: { '@type': 'Place', name: 'Vancouver, BC, Canada' },
    dateModified: meta.generatedAt,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${site}/data/catalog.json`,
        name: 'Activity catalog',
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${site}/data/snapshot.json`,
        name: 'Full snapshot',
      },
    ],
  }
}

/** Serialise nodes as one `@graph` script tag, escaping `<` so `</script>` cannot break out. */
export function jsonLdScript(nodes: JsonLd | JsonLd[]): string {
  const graph = Array.isArray(nodes) ? nodes : [nodes]
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c',
  )
  return `<script type="application/ld+json">${json}</script>`
}
