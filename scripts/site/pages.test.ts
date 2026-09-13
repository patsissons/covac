import { describe, expect, it } from 'vitest'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  occurrencesByActivity,
} from '../../src/data/catalog.ts'
import { index, snapshot } from '../../src/test/fixture.ts'
import {
  activitiesIndexPage,
  activityPage,
  centrePage,
  centresIndexPage,
  eventSessions,
  type PageContext,
} from './pages.ts'
import { sitemapXml } from './sitemap.ts'

const ctx: PageContext = {
  site: 'https://covac.fyi',
  generatedAt: snapshot.generatedAt,
  today: '2026-09-08',
  calendarById: index.calendarById,
}
const sessions = occurrencesByActivity(snapshot.occurrences)
const catalog = buildCatalog(snapshot)
const centres = buildCentres(snapshot).centres

/** Parse the page's JSON-LD graph. */
function graphOf(html: string): Record<string, unknown>[] {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  expect(match).not.toBeNull()
  return JSON.parse(match![1]!)['@graph']
}

describe('activityPage', () => {
  const detail = buildActivityDetail(index, snapshot.activities[0]!, sessions.get(1)!, ctx.today)
  const html = activityPage(detail, ctx)

  it('has the essentials for crawlers and people', () => {
    expect(html).toContain('<title>Free Swim at Britannia Pool · covac</title>')
    expect(html).toContain('<link rel="canonical" href="https://covac.fyi/activities/1/">')
    expect(html).toContain('<h1>Free Swim</h1>')
    expect(html).toContain('href="https://example.com/free-swim/1"')
    expect(html).toContain(
      'href="https://covac.fyi/?week=2026-09-07&amp;centers=37&amp;q=Free+Swim&amp;activity=1"',
    )
    expect(html).toContain('<time datetime="2026-09-07T07:00:00-07:00">7:00 am</time>')
    expect(html).toContain('href="https://covac.fyi/data/activities/1.json"')
    expect(html).toContain('<div class="card"><p>Recreational swim for <b>everyone</b>.</p></div>')
  })

  it('carries breadcrumb, page and per-session Event nodes', () => {
    const graph = graphOf(html)
    expect(graph.map((n) => n['@type'])).toEqual(['BreadcrumbList', 'WebPage', 'Event'])
    expect(graph[2]).toMatchObject({ name: 'Free Swim', startDate: '2026-09-08T14:00:00-07:00' })
  })

  it('escapes hostile titles', () => {
    const hostile = { ...snapshot.activities[0]!, title: 'Swim <script>alert(1)</script>' }
    const page = activityPage(buildActivityDetail(index, hostile, [], ctx.today), ctx)
    expect(page).not.toContain('<script>alert')
    expect(page).toContain('Swim &lt;script&gt;')
  })
})

describe('eventSessions', () => {
  it('prefers upcoming sessions and falls back to the latest', () => {
    const detail = buildActivityDetail(index, snapshot.activities[0]!, sessions.get(1)!, ctx.today)
    expect(eventSessions(detail, '2026-09-08').map((s) => s.s)).toEqual(['2026-09-08T14:00'])
    expect(eventSessions(detail, '2026-10-01').map((s) => s.s)).toEqual([
      '2026-09-07T07:00',
      '2026-09-08T14:00',
    ])
    expect(eventSessions(detail, '2026-01-01', 1)).toHaveLength(1)
  })
})

describe('centrePage', () => {
  it('lists activities by group with a Place node', () => {
    const html = centrePage(
      centres[0]!,
      catalog.activities.filter((a) => a.centerId === 37),
      ctx,
    )
    expect(html).toContain('<h1>Britannia Pool</h1>')
    expect(html).toContain('<address>1661 Napier Street, Vancouver</address>')
    expect(html).toContain('href="https://covac.fyi/?centers=37"')
    expect(html).toContain('href="https://covac.fyi/activities/1/"')
    const graph = graphOf(html)
    expect(graph.map((n) => n['@type'])).toEqual([
      'BreadcrumbList',
      'SportsActivityLocation',
      'ItemList',
    ])
    expect(graph[2]).toMatchObject({ numberOfItems: 1 })
  })
})

describe('index pages', () => {
  it('link every centre and activity', () => {
    const centresHtml = centresIndexPage(centres, ctx)
    expect(centresHtml).toContain('href="https://covac.fyi/centres/37/"')
    expect(centresHtml).toContain('href="https://covac.fyi/centres/44/"')
    const byCentre = new Map<number, typeof catalog.activities>()
    for (const a of catalog.activities)
      byCentre.set(a.centerId, [...(byCentre.get(a.centerId) ?? []), a])
    const activitiesHtml = activitiesIndexPage(centres, byCentre, ctx)
    expect(activitiesHtml).toContain('href="https://covac.fyi/activities/1/"')
    expect(activitiesHtml).toContain('href="https://covac.fyi/activities/2/"')
    expect(graphOf(activitiesHtml)[1]).toMatchObject({ '@type': 'CollectionPage' })
  })
})

describe('sitemapXml', () => {
  it('renders url entries with lastmod', () => {
    const xml = sitemapXml([
      { loc: 'https://covac.fyi/', lastmod: '2026-09-09' },
      { loc: 'https://covac.fyi/a&b/' },
    ])
    expect(xml).toContain('<url><loc>https://covac.fyi/</loc><lastmod>2026-09-09</lastmod></url>')
    expect(xml).toContain('<loc>https://covac.fyi/a&amp;b/</loc>')
    expect(xml.startsWith('<?xml')).toBe(true)
  })
})
