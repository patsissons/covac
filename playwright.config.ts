import { defineConfig, devices } from '@playwright/test'

const port = 4173
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serve the build with wrangler so the suite sees what Cloudflare Pages serves: Functions,
  // `_headers`, `_routes.json` and trailing-slash redirects, none of which `vite preview` has.
  webServer: {
    command: `pnpm build && pnpm exec wrangler pages dev dist --port ${port} --log-level warn`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
})
