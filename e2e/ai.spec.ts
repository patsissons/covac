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
  const body = await catalog.json()
  expect(body.activities.length).toBeGreaterThan(100)
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
