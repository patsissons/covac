import { mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createClient } from './client'
import { fetchActivityDetails } from './enrich'
import { applyEnrichment, buildSnapshot, isPublicCalendar, type CalendarScrape } from './normalize'
import { bundleSnapshot, writeSnapshotFiles } from '../snapshot/files'
import type { SnapshotMeta } from '../../src/types/snapshot'

const { values: args } = parseArgs({
  options: {
    enrich: { type: 'boolean', default: true },
    'no-enrich': { type: 'boolean', default: false },
    'enrich-limit': { type: 'string' },
    calendars: { type: 'string', short: 'c' },
    out: { type: 'string', default: 'public/data' },
    cache: { type: 'string', default: '.cache/details' },
    'no-cache': { type: 'boolean', default: false },
  },
})

const log = (message: string) => console.error(`[scrape] ${message}`)

async function main() {
  const started = Date.now()
  const client = createClient({ log })
  const onlyCalendars = args.calendars?.split(',').map(Number)

  const { calendars } = await client.calendars()
  const targets = calendars
    .filter(isPublicCalendar)
    .filter((c) => !onlyCalendars || onlyCalendars.includes(c.calendar_id))
  log(`${targets.length} calendars`)

  const scrapes: CalendarScrape[] = []
  for (const calendar of targets) {
    const filters = await client.filters(calendar.calendar_id)
    const centerIds = filters.center.map((c) => c.id)
    const centerEvents = centerIds.length
      ? (await client.events(calendar.calendar_id, centerIds)).center_events
      : []
    const count = centerEvents.reduce((n, c) => n + c.events.length, 0)
    log(`${calendar.name}: ${centerIds.length} centres, ${count} events`)
    scrapes.push({ calendar, filters, centerEvents })
  }

  const snapshot = buildSnapshot(scrapes, new Date().toISOString())
  log(
    `bulk done in ${Math.round((Date.now() - started) / 1000)}s: ` +
      `${snapshot.activities.length} activities, ${snapshot.occurrences.length} occurrences, ` +
      `${snapshot.centers.length} centres`,
  )

  let enriched = 0
  if (args.enrich && !args['no-enrich']) {
    const details = await fetchActivityDetails({
      client,
      snapshot,
      cacheDir: args['no-cache'] ? undefined : args.cache,
      limit: args['enrich-limit'] ? Number(args['enrich-limit']) : undefined,
      log,
    })
    enriched = applyEnrichment(snapshot, details)
    log(`enriched ${enriched}/${snapshot.activities.length} activities`)
  }

  const meta: SnapshotMeta = {
    generatedAt: snapshot.generatedAt,
    period: snapshot.period,
    counts: {
      calendars: snapshot.calendars.length,
      centers: snapshot.centers.length,
      activities: snapshot.activities.length,
      occurrences: snapshot.occurrences.length,
      enriched,
    },
  }
  await mkdir(args.out, { recursive: true })
  // Committed, pretty-printed per-collection files plus a local copy of the runtime bundle
  // (gitignored; the Vite build regenerates it).
  await writeSnapshotFiles(args.out, snapshot, meta)
  await bundleSnapshot(args.out)
  log(`wrote ${args.out}/snapshot.*.json in ${Math.round((Date.now() - started) / 1000)}s`)
}

main().catch((error) => {
  log(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exit(1)
})
