/**
 * Render `template.html` to `public/og.png` at the Open Graph size (1200×630) with the same
 * Chromium that Playwright uses for e2e tests. Run with `pnpm og` after editing the template.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const here = path.dirname(fileURLToPath(import.meta.url))
const template = path.join(here, 'template.html')
const out = path.resolve(here, '../../public/og.png')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 1,
  })
  await page.goto(pathToFileURL(template).href)
  await page.evaluate(() => document.fonts.ready)
  await mkdir(path.dirname(out), { recursive: true })
  await page.screenshot({
    path: out,
    type: 'png',
    clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
  })
  console.log(`wrote ${path.relative(process.cwd(), out)} (${OG_WIDTH}×${OG_HEIGHT})`)
} finally {
  await browser.close()
}
