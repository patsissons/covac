import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/** Pick a Monday inside the committed snapshot so the tests do not depend on today's date. */
const meta = JSON.parse(readFileSync('public/data/snapshot.meta.json', 'utf8')) as {
  period: { start: string; end: string }
}
const [y, m, d] = meta.period.start.split('-').map(Number)
const start = new Date(y!, m! - 1, d!)
start.setDate(start.getDate() + ((8 - start.getDay()) % 7)) // first Monday on or after start
const week = start.toISOString().slice(0, 10)

const gotoWeek = (page: Page, search = '') => page.goto(`/?week=${week}${search}`)

test('renders the week grid with locations and sessions', async ({ page }) => {
  await gotoWeek(page)
  await expect(page.getByRole('heading', { level: 1, name: 'covac' })).toBeVisible()
  await expect(page.getByText(/sessions this week/)).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveCount(8)
  expect(await table.getByRole('rowheader').count()).toBeGreaterThan(10)
})

test('filtering by the Public Swimming calendar shows only pools', async ({ page }) => {
  await gotoWeek(page, '&cal=55')
  const rows = page.getByRole('table').getByRole('rowheader')
  await expect(rows.first()).toBeVisible()
  const names = await rows.allTextContents()
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((name) => /Pool|Aquatic/i.test(name))).toBe(true)
  await expect(page.getByRole('combobox', { name: 'Calendars' })).toContainText('1')
})

test('time and day filters narrow the results and sync to the URL', async ({ page }) => {
  await gotoWeek(page)
  const count = page.getByText(/sessions this week/)
  const all = Number((await count.textContent())!.replace(/[^\d]/g, ''))
  await page.getByRole('button', { name: 'Sat', exact: true }).click()
  await expect(page).toHaveURL(/days=6/)
  await expect(page.getByRole('table').getByRole('columnheader')).toHaveCount(2)
  const saturday = Number((await count.textContent())!.replace(/[^\d]/g, ''))
  expect(saturday).toBeLessThan(all)
  await page.getByRole('button', { name: /Clear filters/ }).click()
  await expect(page).not.toHaveURL(/days=/)
})

test('clicking a session opens the detail panel with an ActiveNet link', async ({ page }) => {
  await gotoWeek(page)
  const chip = page.getByRole('table').getByRole('button').first()
  const title = (await chip.textContent())!.replace(/^[\d:–\sapm]+/, '')
  await chip.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(title)
  await expect(dialog).toContainText(/Sessions \(\d+\)/)
  await expect(dialog.getByRole('link', { name: /ActiveNet/ })).toHaveAttribute(
    'href',
    /activecommunities\.com\/vancouver\/Activity_Search\//,
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('the map shows a pin per centre and toggles a centre filter', async ({ page }) => {
  await gotoWeek(page)
  await page.getByRole('button', { name: 'Show map' }).click()
  const map = page.getByTestId('center-map')
  await expect(map).toBeVisible()
  const pins = map.locator('path.leaflet-interactive')
  await expect(pins.first()).toBeVisible()
  expect(await pins.count()).toBe(40)
  // Pins overlap at city zoom, so dispatch the click instead of relying on hit-testing.
  await pins.first().dispatchEvent('click')
  await expect(page).toHaveURL(/centers=\d+/)
  await expect(page.getByRole('table').getByRole('rowheader')).toHaveCount(1)
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 400, height: 800 } })

  test('shows a single day with tabs and no horizontal page scroll', async ({ page }) => {
    await gotoWeek(page)
    await expect(page.getByRole('tablist', { name: 'Day' })).toBeVisible()
    await expect(page.getByRole('table').getByRole('columnheader')).toHaveCount(2)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    await page.getByRole('tab').nth(2).click()
    await expect(page.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
  })
})
