import { expect, test } from '@playwright/test'

test('home page renders the site heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'covac' })).toBeVisible()
  await expect(page).toHaveTitle(/City of Vancouver Active Communities/)
})

test('home page carries Open Graph metadata', async ({ page }) => {
  await page.goto('/')
  const meta = (selector: string) => page.locator(`head meta[${selector}]`)
  await expect(meta('property="og:title"')).toHaveAttribute(
    'content',
    'covac · City of Vancouver Active Communities',
  )
  await expect(meta('property="og:type"')).toHaveAttribute('content', 'website')
  await expect(meta('property="og:url"')).toHaveAttribute('content', 'https://covac.pages.dev/')
  await expect(meta('property="og:image"')).toHaveAttribute(
    'content',
    'https://covac.pages.dev/og.png',
  )
  await expect(meta('property="og:image:width"')).toHaveAttribute('content', '1200')
  await expect(meta('property="og:image:height"')).toHaveAttribute('content', '630')
  await expect(meta('name="twitter:card"')).toHaveAttribute('content', 'summary_large_image')
})

test('the Open Graph image is served at 1200×630', async ({ page, request }) => {
  const response = await request.get('/og.png')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')
  await page.goto('/og.png')
  const size = await page.evaluate(() => {
    const img = document.querySelector('img')
    return img && { width: img.naturalWidth, height: img.naturalHeight }
  })
  expect(size).toEqual({ width: 1200, height: 630 })
})
