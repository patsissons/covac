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
   each activity with age range, openings (kept verbatim and parsed into an availability status
   plus remaining spaces) and centre coordinates from the per-activity details endpoint. It writes one pretty-printed file per collection to `public/data/`
   (`snapshot.calendars.json`, `.centers`, `.facilities`, `.activities`, `.occurrences`; about
   5 MB in total) plus a small `snapshot.meta.json` with the scrape time, period and counts, so
   each nightly commit shows the lines that actually changed.
2. The scrape workflow runs nightly and commits the files when the data changed. Cloudflare
   Pages redeploys on push.
3. A Vite plugin (`vite.config.ts`) merges the files into `public/data/snapshot.json` (about
   4 MB, 550 KB gzipped) before every dev server start and build. That bundle is gitignored, and
   the build output contains only the bundle, not the split files.
4. The build also writes machine-readable views of the same data (data shards, prerendered
   pages, `llms.txt`, see below) and a Cloudflare Pages Function serves an MCP endpoint over the
   shards.
5. The app loads the snapshot, indexes it in memory, and renders the week. The default **By time**
   view stacks every location into hourly rows so a glance down the Monday column shows everything
   between, say, 4 pm and 8 pm; **By location** gives one row per centre. Filters, the view and
   the selected week live in the query string
   (`?week=2026-09-14&view=location&cal=55&centers=37&from=12:00&days=6,0&q=swim&pmin=5&pmax=20&open=1`),
   and `activity=<id>` opens that activity's detail panel, which is how the prerendered pages and
   MCP results deep-link into the calendar
   so any view can be shared. The price slider filters on each activity's lowest price (free
   counts as $0); activities whose price the snapshot does not know are hidden while a price
   bound is set. Every chip shows the openings as of the last scrape (`12 left`, `Unlimited`,
   `Full`, `Closed`, `Cancelled`); full, closed and cancelled sessions are faded, and the **Hide
   unavailable** toggle (`open=1`) drops them. Clicking the date range opens a day picker that
   jumps to that day's week.

### Machine-readable data

Besides the app's own `snapshot.json`, the build writes compact JSON "shards" under `dist/data/`
(so they exist on the deployed site, never in `public/`). They are sized so that a Cloudflare
Pages Function on the free plan can parse what one request needs inside its 10 ms CPU budget,
and they double as a public read-only data API. `pnpm site:generate` regenerates them into an
existing `dist/` without rebuilding the app.

| URL                          | Contents                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/data/meta.json`            | Scrape time, period, counts, the Mondays of every week with sessions, generator version                                                   |
| `/data/calendars.json`       | The calendars with their group (`Drop-in`, `Fitness`, `Sports`, `Art & Culture`)                                                          |
| `/data/centres.json`         | Centres with address, phone, coordinates and activity count, plus facilities                                                              |
| `/data/catalog.json`         | Every activity without its description HTML, fee table or URL: enough to search and filter, including `availability` and `spaces` (~2 MB) |
| `/data/weeks/{monday}.json`  | All sessions (`{a, s, e}`) in one Monday-based week                                                                                       |
| `/data/activities/{id}.json` | One activity in full: plain-text description, fees, centre, calendar, sessions and covac links                                            |
| `/data/snapshot.json`        | The whole snapshot the app loads (~4 MB)                                                                                                  |

All `/data/*` responses carry `Access-Control-Allow-Origin: *` and five minutes of edge caching
(`public/_headers`). Times are Vancouver local with no offset, as everywhere in the snapshot. The
shapes are the TypeScript interfaces in `src/data/catalog.ts`.

### Prerendered pages and structured data

Search engines and AI crawlers do not run the app's JavaScript, so the build also prerenders
plain HTML for every activity (`/activities/{id}/`) and centre (`/centres/{id}/`), plus two index
pages, from `scripts/site/pages.ts`. Each page carries schema.org JSON-LD (one `Event` per
upcoming session with Vancouver offsets, the centre as a `SportsActivityLocation`, breadcrumbs),
a canonical URL, Open Graph tags, a link to the activity's JSON, the ActiveNet registration link
and a deep link into the calendar. `sitemap.xml` lists them all; `public/robots.txt` allows every
crawler explicitly, AI search bots included; the app shell in `index.html` gets `WebSite` and
`Dataset` JSON-LD plus `<noscript>` links to the indexes at build time.

### llms.txt

`/llms.txt` is a short markdown index for language models: what the site is, how to query it (MCP
endpoint and the data API above), one link per centre to `/llms/centres/{id}.md` (full write-ups
of every activity there: description, fees, ages, sessions, links) and the calendar list.
`/llms-full.txt` lists every activity on one line with a link to its page. All three are generated
at build by `scripts/site/llms.ts` and served as text with CORS (`public/_headers`); the app
shell links `llms.txt` as an alternate representation.

### MCP server

`https://covac.fyi/mcp` is a remote [Model Context Protocol](https://modelcontextprotocol.io)
server (Streamable HTTP, no authentication, read-only) so agents can query the data directly.
It speaks the 2026-07-28 stateless protocol and still answers 2025-era clients through the SDK's
stateless legacy path. Add it to a client with its URL, for example:

```sh
claude mcp add --transport http covac https://covac.fyi/mcp
npx @modelcontextprotocol/inspector   # then connect to https://covac.fyi/mcp
```

In ChatGPT it works as a custom connector (Settings → Connectors → Developer mode) and follows
the connector contract: `search` returns `{ results: [{ id, title, url }] }` and `fetch`
returns `{ id, title, text, url, metadata }`, both as structured content and as JSON text.

| Tool              | What it does                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `search`          | Free-text search over titles, instructors, centres, calendars and descriptions; ids + page URLs               |
| `fetch`           | One activity as a markdown document with metadata                                                             |
| `find_activities` | Filter sessions by text, group, calendars, centres, dates, days, times, price, free only, available only, age |
| `get_activity`    | Full structured record for one activity, sessions with UTC offsets                                            |
| `list_centres`    | Centres with address, phone, coordinates, activity counts                                                     |
| `list_calendars`  | Calendars and their groups                                                                                    |
| `get_schedule`    | Everything on one date, grouped by centre                                                                     |
| `snapshot_info`   | Scrape time, period, counts, weeks, links                                                                     |

It also exposes resources (`covac://snapshot`, `covac://centres`, `covac://calendars`,
`covac://activities/{id}`) and a `plan_activities` prompt.

The server is a Cloudflare Pages Function (`functions/mcp.ts`, code in `mcp/`) built on
`@modelcontextprotocol/server`. It never parses the 4 MB snapshot: each tool reads only the
shards it needs through the `ASSETS` binding and caches them per isolate, which keeps a cold
request within the Workers free plan's 10 ms CPU budget. `public/_routes.json` sends only
`/mcp` and `/.well-known/mcp` to Functions; every other path is a free static request.
For discovery, `/.well-known/mcp` serves a small manifest from a Function and the build writes a
server card to `/.well-known/mcp/server-card.json` whose tool list is generated from the same
definitions the server registers. Locally, `pnpm dev:cf` serves the endpoint
at `http://localhost:8788/mcp`; `pnpm mcp:build` bundles the Functions as a check without
serving them.

### The ActiveNet API

The calendar page at `anc.ca.apm.activecommunities.com/vancouver/calendars` is a React app backed
by an unauthenticated JSON API under `/vancouver/rest/onlinecalendar`. The scraper uses:

| Endpoint                                 | Method | Notes                                                                                                |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `/calendars`                             | GET    | 24 calendars; id 23 is a "Choose a Calendar" placeholder                                             |
| `/filters`                               | POST   | `{"calendar_id": N}` → centres, facilities, categories and the calendar's date range                 |
| `/multicenter/events`                    | POST   | calendar id + all its centre ids → every session in the ~8 week window, in one response              |
| `/activity-details/{id}?selected_date=…` | GET    | age range, openings (`space_status` label and `space_type` code), price, centre address and lat/long |

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
| `pnpm dev:cf`              | Build and serve `dist/` with `wrangler pages dev` (port 8788)  |
| `pnpm og`                  | Re-render `public/og.png` (the Open Graph preview image)       |
| `pnpm site:generate`       | Regenerate the machine-readable files into an existing `dist/` |
| `pnpm test`                | Run unit tests with Vitest                                     |
| `pnpm test:watch`          | Run unit tests in watch mode                                   |
| `pnpm test:e2e`            | Run Playwright end-to-end tests against a built preview server |
| `pnpm format`              | Format all files with Prettier                                 |
| `pnpm format:check`        | Check formatting without writing                               |
| `pnpm typecheck`           | Run the TypeScript compiler over all project references        |
| `pnpm lint`                | Run ESLint                                                     |
| `pnpm mcp:build`           | Bundle the Pages Functions with wrangler as a compile check    |
| `pnpm validate:quick`      | Format check, type check, lint, Functions bundle, unit tests   |
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

The site lives at <https://covac.fyi> and deploys to Cloudflare Pages from the `main` branch.
Build command `pnpm build`, output directory `dist`; runtime settings (compatibility date and
flags) come from `wrangler.toml`, which Pages reads because it sets `pages_build_output_dir`.
The build generates `dist/data/snapshot.json` and the machine-readable files from the committed
split files. `pnpm dev:cf` builds and serves `dist/` with `wrangler pages dev`, which is also
what the e2e suite runs against, so Pages behaviour (`_headers`, redirects, Functions) is
exercised locally.

GitHub Actions:

- `ci.yml` runs `pnpm validate` on pushes and pull requests.
- `scrape.yml` runs the scraper nightly at 03:00 Pacific (and on demand from the Actions tab) and
  commits `public/data/` when the data changed, which triggers a Pages deploy.

## Data notice

This is an unofficial mirror. Activity data belongs to the City of Vancouver Board of Parks and
Recreation and is published through ActiveNet; always confirm details there before attending, and
register there. Nothing here is affiliated with the City or with Active Network.
