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

test('renders the time grid by default with every location stacked', async ({ page }) => {
  await gotoWeek(page)
  await expect(page.getByRole('heading', { level: 1, name: 'covac' })).toBeVisible()
  await expect(page.getByText(/sessions this week/)).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveCount(8)
  await expect(table.getByRole('rowheader').first()).toHaveText(/^\d{1,2} [ap]m$/)
  await expect(page.getByTestId('visible-locations')).toContainText(/\d+ locations shown/)
  // Chips in the time view carry their centre name.
  await expect(table.getByRole('button').first()).toContainText(
    /Centre|Pool|Park|Rink|Arena|Complex/,
  )
})

test('switching to the location view gives one row per centre', async ({ page }) => {
  await gotoWeek(page)
  await page.getByRole('radio', { name: 'By location' }).click()
  await expect(page).toHaveURL(/view=location/)
  const table = page.getByRole('table')
  expect(await table.getByRole('rowheader').count()).toBeGreaterThan(10)
  await page.getByRole('radio', { name: 'By time' }).click()
  await expect(page).not.toHaveURL(/view=/)
})

test('picking a day from the calendar selects its week', async ({ page }) => {
  await gotoWeek(page)
  await page.getByRole('button', { name: 'Choose a day' }).click()
  const wednesday = new Date(start)
  wednesday.setDate(wednesday.getDate() + 9) // Wednesday of the following week
  const day = wednesday.toISOString().slice(0, 10)
  await page.locator(`td[data-day="${day}"] button`).click()
  const monday = new Date(wednesday)
  monday.setDate(monday.getDate() - 2)
  await expect(page).toHaveURL(new RegExp(`week=${monday.toISOString().slice(0, 10)}`))
  await expect(page.getByRole('button', { name: 'Choose a day' })).toContainText(
    monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  )
})

test('filtering by the Public Swimming calendar shows only pools', async ({ page }) => {
  await gotoWeek(page, '&cal=55&view=location')
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
  const title = (await chip.locator('[data-slot="title"]').textContent())!
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
  await gotoWeek(page, '&view=location')
  await page.getByRole('button', { name: 'Show map' }).click()
  const map = page.getByTestId('center-map')
  await expect(map).toBeVisible()
  const pins = map.locator('path.leaflet-interactive')
  await expect(pins.first()).toBeVisible()
  // One pin per location with a session this week, which is one row per centre in this view.
  const rows = await page.getByRole('table').getByRole('rowheader').count()
  expect(await pins.count()).toBe(rows)
  // Pins overlap at city zoom, so dispatch the click instead of relying on hit-testing.
  await pins.first().dispatchEvent('click')
  await expect(page).toHaveURL(/centers=\d+/)
  await expect(page.getByRole('table').getByRole('rowheader')).toHaveCount(1)
})

test('legend pips toggle a whole calendar group', async ({ page }) => {
  await gotoWeek(page)
  await page.getByRole('button', { name: 'Fitness', exact: true }).click()
  await expect(page).toHaveURL(/cal=/)
  await expect(page.getByRole('button', { name: 'Fitness', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('combobox', { name: 'Calendars' })).toContainText(/\d/)
  await page.getByRole('button', { name: 'Fitness', exact: true }).click()
  await expect(page).not.toHaveURL(/cal=/)
})

test('the day header stays visible while scrolling the grid', async ({ page }) => {
  await gotoWeek(page)
  const scroller = page.getByTestId('grid-scroll')
  await scroller.evaluate((el) => el.scrollTo({ top: 1500 }))
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  const header = page.getByRole('table').getByRole('columnheader').nth(1)
  const [h, s] = await Promise.all([header.boundingBox(), scroller.boundingBox()])
  expect(h!.y).toBeGreaterThanOrEqual(s!.y - 1)
  expect(h!.y).toBeLessThan(s!.y + h!.height + 1)
})

test('popovers open above the map', async ({ page }) => {
  await gotoWeek(page)
  await page.getByRole('button', { name: 'Show map' }).click()
  await expect(page.getByTestId('center-map')).toBeVisible()
  await page.getByRole('combobox', { name: 'Calendars' }).click()
  const option = page.getByRole('option').first()
  await expect(option).toBeVisible()
  // The element under the option's centre must be the option itself, not a map tile.
  const onTop = await option.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return el === hit || el.contains(hit)
  })
  expect(onTop).toBe(true)
})

test('the footer links to the GitHub repo', async ({ page }) => {
  await gotoWeek(page)
  await expect(page.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/patsissons/covac',
  )
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
