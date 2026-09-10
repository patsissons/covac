import { expect, test } from '@playwright/test'

test('home page renders the site heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'covac' })).toBeVisible()
  await expect(page).toHaveTitle(/City of Vancouver Active Communities/)
})
