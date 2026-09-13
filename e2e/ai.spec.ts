import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

/** A real activity id from the committed snapshot, so the prerendered page exists. */
async function sampleActivity(): Promise<{ id: number; title: string; centerId: number }> {
  const activities = JSON.parse(await readFile('public/data/snapshot.activities.json', 'utf8'))
  return activities[0]
}

test('an activity page renders with Event structured data', async ({ page }) => {
  const activity = await sampleActivity()
  const response = await page.goto(`/activities/${activity.id}/`)
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(activity.title)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://covac.fyi/activities/${activity.id}/`,
  )
  await expect(page.getByRole('link', { name: /ActiveNet/ })).toHaveAttribute(
    'href',
    /activecommunities\.com/,
  )
  const graph = await page.locator('script[type="application/ld+json"]').first().textContent()
  const nodes = JSON.parse(graph!)['@graph'] as { '@type': string; startDate?: string }[]
  expect(nodes.map((n) => n['@type'])).toContain('BreadcrumbList')
  const event = nodes.find((n) => n['@type'] === 'Event')
  expect(event).toBeDefined()
  expect(event!.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[78]:00$/)
})

test('centre pages and indexes link to each other', async ({ page }) => {
  const activity = await sampleActivity()
  await page.goto('/centres/')
  await expect(page.getByRole('heading', { level: 1, name: 'Recreation centres' })).toBeVisible()
  await page.goto(`/centres/${activity.centerId}/`)
  await expect(page.getByRole('link', { name: activity.title }).first()).toHaveAttribute(
    'href',
    `https://covac.fyi/activities/${activity.id}/`,
  )
  await page.goto('/activities/')
  await expect(page.getByRole('heading', { level: 1, name: 'Recreation activities' })).toBeVisible()
})

test('sitemap and robots point crawlers at the pages', async ({ request }) => {
  const activity = await sampleActivity()
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(await sitemap.text()).toContain(`<loc>https://covac.fyi/activities/${activity.id}/</loc>`)
  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  const text = await robots.text()
  expect(text).toContain('User-agent: OAI-SearchBot')
  expect(text).toContain('Sitemap: https://covac.fyi/sitemap.xml')
})

test('the app shell carries site-level structured data and no-JS links', async ({ page }) => {
  await page.goto('/')
  const graph = await page.locator('script[type="application/ld+json"]').first().textContent()
  const types = (JSON.parse(graph!)['@graph'] as { '@type': string }[]).map((n) => n['@type'])
  expect(types).toEqual(['WebSite', 'Dataset'])
  expect(await page.locator('noscript').count()).toBeGreaterThan(0)
})

test('the data API serves the catalog and one activity', async ({ request }) => {
  const activity = await sampleActivity()
  const catalog = await request.get('/data/catalog.json')
  expect(catalog.ok()).toBe(true)
  const body = (await catalog.json()) as { activities: { availability?: string }[] }
  expect(body.activities.length).toBeGreaterThan(100)
  // The nightly scrape classifies nearly every activity; open ones dominate.
  expect(body.activities.filter((a) => a.availability === 'open').length).toBeGreaterThan(100)
  const detail = await request.get(`/data/activities/${activity.id}.json`)
  expect(detail.ok()).toBe(true)
  expect((await detail.json()).title).toBe(activity.title)
})

test('llms.txt and the per-centre markdown are served as text', async ({ request }) => {
  const activity = await sampleActivity()
  const llms = await request.get('/llms.txt')
  expect(llms.ok()).toBe(true)
  expect(llms.headers()['content-type']).toContain('text/plain')
  const text = await llms.text()
  expect(text.startsWith('# covac\n')).toBe(true)
  expect(text).toContain(`https://covac.fyi/llms/centres/${activity.centerId}.md`)
  const full = await request.get('/llms-full.txt')
  expect(full.ok()).toBe(true)
  expect(await full.text()).toContain(`https://covac.fyi/activities/${activity.id}/`)
  const centre = await request.get(`/llms/centres/${activity.centerId}.md`)
  expect(centre.ok()).toBe(true)
  expect(await centre.text()).toContain(`### ${activity.title}`)
})

test('Pages serving rules apply: redirects and headers', async ({ request }) => {
  const activity = await sampleActivity()
  const bare = await request.get(`/activities/${activity.id}`, { maxRedirects: 0 })
  expect([301, 308]).toContain(bare.status())
  expect(bare.headers()['location']).toMatch(new RegExp(`/activities/${activity.id}/$`))
  const catalog = await request.get('/data/catalog.json')
  expect(catalog.headers()['cache-control']).toContain('max-age=300')
  expect(catalog.headers()['access-control-allow-origin']).toBe('*')
  const centre = await request.get(`/llms/centres/${activity.centerId}.md`)
  expect(centre.headers()['content-type']).toContain('text/markdown')
})

const ENVELOPE = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'playwright', version: '0' },
  'io.modelcontextprotocol/clientCapabilities': {},
}

test('the MCP endpoint lists tools and serves search and fetch', async ({ request }) => {
  const activity = await sampleActivity()
  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
    }
    if (typeof params.name === 'string') headers['mcp-name'] = params.name
    const response = await request.post('/mcp', {
      headers,
      data: { jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: ENVELOPE } },
    })
    expect(response.ok()).toBe(true)
    expect(response.headers()['access-control-allow-origin']).toBe('*')
    return (await response.json()) as { result: Record<string, unknown> }
  }

  const list = await rpc('tools/list')
  const names = (list.result.tools as { name: string }[]).map((t) => t.name)
  expect(names).toEqual([
    'search',
    'fetch',
    'find_activities',
    'get_activity',
    'list_centres',
    'list_calendars',
    'get_schedule',
    'snapshot_info',
  ])

  const search = await rpc('tools/call', {
    name: 'search',
    arguments: { query: activity.title.split(' ')[0] },
  })
  const results = (search.result.structuredContent as { results: { id: string; url: string }[] })
    .results
  expect(results.length).toBeGreaterThan(0)
  expect(results[0]!.url).toMatch(/^http:\/\/localhost:4173\/activities\/\d+\/$/)

  const fetched = await rpc('tools/call', { name: 'fetch', arguments: { id: String(activity.id) } })
  const doc = fetched.result.structuredContent as { title: string; text: string; url: string }
  expect(doc.title).toBe(activity.title)
  expect(doc.text).toContain('ActiveNet')
  expect(doc.url).toBe(`http://localhost:4173/activities/${activity.id}/`)

  const info = await rpc('tools/call', { name: 'snapshot_info', arguments: {} })
  expect(
    (info.result.structuredContent as { counts: { activities: number } }).counts.activities,
  ).toBeGreaterThan(100)
})

test('the MCP endpoint still answers 2025-era clients', async ({ request }) => {
  const response = await request.post('/mcp', {
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'old', version: '1' },
      },
    },
  })
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('"serverInfo"')
})

test('MCP discovery documents are served', async ({ request }) => {
  const manifest = await request.get('/.well-known/mcp')
  expect(manifest.ok()).toBe(true)
  expect(manifest.headers()['content-type']).toContain('application/json')
  expect(manifest.headers()['access-control-allow-origin']).toBe('*')
  const body = (await manifest.json()) as { endpoints: { streamable_http: string } }
  expect(body.endpoints.streamable_http).toBe('http://localhost:4173/mcp')
  const card = await request.get('/.well-known/mcp/server-card.json')
  expect(card.ok()).toBe(true)
  expect(card.headers()['access-control-allow-origin']).toBe('*')
  const json = (await card.json()) as { tools: { name: string }[]; transport: { endpoint: string } }
  expect(json.transport.endpoint).toBe('https://covac.fyi/mcp')
  expect(json.tools.map((t) => t.name)).toContain('find_activities')
})
