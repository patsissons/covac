# covac

**City of Vancouver Active Communities** – a better calendar for City of Vancouver recreation
activities.

The city publishes drop-in activities and registered programs through ActiveNet at
<https://anc.ca.apm.activecommunities.com/vancouver/calendars>. That UI makes you pick one
calendar, then add centres one at a time, before anything renders. covac shows a week grid of
**locations × days** across every calendar at once, with filters, an activity detail panel that
links back to ActiveNet for registration, and a map of centres.

The site is fully static. A scheduled scraper pulls the ActiveNet calendar API into committed
JSON files, the build merges them into one snapshot, and the React app reads only that snapshot
at runtime.

## How it works

```
ActiveNet REST API ──(pnpm scrape, nightly via GitHub Actions)──▶ public/data/snapshot.*.json
                                                                        │  (committed, pretty)
                                                   pnpm build ◀─────────┘
                                                        │  merges + minifies
                                                        ▼
                                  React app ◀── dist/data/snapshot.json  fetched once at load
```

1. `scripts/scrape/` pulls every public calendar from the ActiveNet online calendar API,
   dedupes activities, strips ActiveNet's naming quirks, sanitizes descriptions, and enriches
   each activity with age range, openings and centre coordinates from the per-activity details
   endpoint. It writes one pretty-printed file per collection to `public/data/`
   (`snapshot.calendars.json`, `.centers`, `.facilities`, `.activities`, `.occurrences`; about
   5 MB in total) plus a small `snapshot.meta.json` with the scrape time, period and counts, so
   each nightly commit shows the lines that actually changed.
2. The scrape workflow runs nightly and commits the files when the data changed. Cloudflare
   Pages redeploys on push.
3. A Vite plugin (`vite.config.ts`) merges the files into `public/data/snapshot.json` (about
   4 MB, 550 KB gzipped) before every dev server start and build. That bundle is gitignored, and
   the build output contains only the bundle, not the split files.
4. The app loads the snapshot, indexes it in memory, and renders the week. The default **By time**
   view stacks every location into hourly rows so a glance down the Monday column shows everything
   between, say, 4 pm and 8 pm; **By location** gives one row per centre. Filters, the view and
   the selected week live in the query string
   (`?week=2026-09-14&view=location&cal=55&centers=37&from=12:00&days=6,0&q=swim&pmin=5&pmax=20`)
   so any view can be shared. The price slider filters on each activity's lowest price (free
   counts as $0); activities whose price the snapshot does not know are hidden while a price
   bound is set. Clicking the date range opens a day picker that jumps to that day's week.

### The ActiveNet API

The calendar page at `anc.ca.apm.activecommunities.com/vancouver/calendars` is a React app backed
by an unauthenticated JSON API under `/vancouver/rest/onlinecalendar`. The scraper uses:

| Endpoint                                 | Method | Notes                                                                                   |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `/calendars`                             | GET    | 24 calendars; id 23 is a "Choose a Calendar" placeholder                                |
| `/filters`                               | POST   | `{"calendar_id": N}` → centres, facilities, categories and the calendar's date range    |
| `/multicenter/events`                    | POST   | calendar id + all its centre ids → every session in the ~8 week window, in one response |
| `/activity-details/{id}?selected_date=…` | GET    | age range, openings, price, centre address and lat/long                                 |

There are no date parameters; each calendar returns its whole rolling window. A full pull is 46
bulk requests plus one details request per activity (about 3,200), and takes around two minutes
with four concurrent requests. The API rejects browser CORS preflights, which is why the site
reads a committed snapshot instead of calling ActiveNet directly.

Times in the data are Vancouver local time with no timezone; the app stores and renders them
as-is.

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
| `pnpm og`                  | Re-render `public/og.png` (the Open Graph preview image)       |
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

### Scraper options

```sh
pnpm scrape                      # full scrape with enrichment, caches details in .cache/details
pnpm scrape --no-enrich          # bulk calendars only (about 45 s)
pnpm scrape --enrich-limit 20    # enrich only the first 20 activities
pnpm scrape -c 55,3              # only these calendar ids
pnpm scrape --no-cache           # ignore and do not write the details cache (what CI uses)
pnpm scrape --out some/dir       # write elsewhere than public/data
```

The scraper also writes a local `snapshot.json` bundle next to the split files so a running dev
server picks up fresh data. `pnpm exec tsx scripts/snapshot/changed.ts` exits 0 when the split
files differ from the committed ones in anything other than `generatedAt`; the scrape workflow
uses it to skip no-op commits.

### Open Graph image

`public/og.png` is the 1200×630 preview that chat apps and social sites show for shared links;
`index.html` points at it with absolute `og:image` and `twitter:image` URLs. It is rendered from
`scripts/og/template.html` (plain HTML and CSS using the app's Geist font and calendar-group
colours) by `pnpm og`, which screenshots the template with Playwright's Chromium. Edit the
template, re-run the script, and commit the PNG.

## Stack

Vite, React, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest, Playwright, ESLint, Prettier.

## Deployment

The site lives at <https://covac.fyi> and deploys to Cloudflare Pages from the `main` branch. Build command `pnpm build`, output
directory `dist`. The build generates `dist/data/snapshot.json` from the committed split files.
No server-side code is needed.

GitHub Actions:

- `ci.yml` runs `pnpm validate` on pushes and pull requests.
- `scrape.yml` runs the scraper nightly at 03:00 Pacific (and on demand from the Actions tab) and
  commits `public/data/` when the data changed, which triggers a Pages deploy.

## Data notice

This is an unofficial mirror. Activity data belongs to the City of Vancouver Board of Parks and
Recreation and is published through ActiveNet; always confirm details there before attending, and
register there. Nothing here is affiliated with the City or with Active Network.
