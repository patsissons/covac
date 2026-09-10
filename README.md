# covac

**City of Vancouver Active Communities** – a better calendar for City of Vancouver recreation
activities.

The city publishes drop-in activities and registered programs through ActiveNet at
<https://anc.ca.apm.activecommunities.com/vancouver/calendars>. That UI makes you pick one
calendar, then add centres one at a time, before anything renders. covac shows a week grid of
**locations × days** across every calendar at once, with filters, an activity detail panel that
links back to ActiveNet for registration, and a map of centres.

The site is fully static. A scheduled scraper pulls the ActiveNet calendar API into a committed
JSON snapshot, and the React app reads only that snapshot at runtime.

## Setup

Requires Node 22+ and [pnpm](https://pnpm.io) (the version is pinned in `package.json`).

```sh
pnpm install
pnpm exec playwright install chromium   # once, for e2e tests
pnpm dev
```

## Scripts

| Script                     | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                 | Start the Vite dev server                                      |
| `pnpm build`               | Type check and build the production bundle into `dist/`        |
| `pnpm preview`             | Serve the production build locally                             |
| `pnpm test`                | Run unit tests with Vitest                                     |
| `pnpm test:watch`          | Run unit tests in watch mode                                   |
| `pnpm test:e2e`            | Run Playwright end-to-end tests against a built preview server |
| `pnpm format`              | Format all files with Prettier                                 |
| `pnpm format:check`        | Check formatting without writing                               |
| `pnpm typecheck`           | Run the TypeScript compiler over all project references        |
| `pnpm lint`                | Run ESLint                                                     |
| `pnpm validate:quick`      | Format check, type check, lint, and unit tests                 |
| `pnpm validate`            | `validate:quick` followed by the e2e suite (what CI runs)      |
| `pnpm format-and-validate` | Prettier write, then `validate`; run this before committing    |

## Stack

Vite, React, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest, Playwright, ESLint, Prettier.

## Deployment

The site deploys to Cloudflare Pages from the `main` branch. Build command `pnpm build`, output
directory `dist`.
