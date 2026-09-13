/**
 * Generate everything derived from the snapshot for machine readers into the build output: data
 * shards, prerendered activity and centre pages, and the sitemap. Runs from the Vite plugin's
 * `closeBundle` and from `pnpm site:generate`.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  occurrencesByActivity,
  type CatalogActivity,
} from '../../src/data/catalog.ts'
import type { DateString } from '../../src/data/dates.ts'
import { buildIndex } from '../../src/data/index.ts'
import { activityPagePath, centrePagePath, SITE_URL } from '../../src/data/links.ts'
import type { Snapshot } from '../../src/types/snapshot.ts'
import {
  activitiesIndexPage,
  activityPage,
  centrePage,
  centresIndexPage,
  type PageContext,
} from './pages.ts'
import { writeShards } from './shards.ts'
import { sitemapXml, type SitemapEntry } from './sitemap.ts'

export interface SiteOptions {
  snapshot: Snapshot
  outDir: string
  version: string
  today: DateString
  site?: string
}

export interface SiteReport {
  files: number
}

async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text)
}

/** Write the prerendered pages and return the sitemap entries for them. */
export async function writePages(options: SiteOptions): Promise<SitemapEntry[]> {
  const { snapshot, outDir, today } = options
  const site = options.site ?? SITE_URL
  const index = buildIndex(snapshot)
  const catalog = buildCatalog(snapshot)
  const centres = buildCentres(snapshot).centres
  const byActivity = occurrencesByActivity(snapshot.occurrences)
  const byCentre = new Map<number, CatalogActivity[]>()
  for (const activity of catalog.activities) {
    const list = byCentre.get(activity.centerId)
    if (list) list.push(activity)
    else byCentre.set(activity.centerId, [activity])
  }
  const ctx: PageContext = {
    site,
    generatedAt: snapshot.generatedAt,
    today,
    calendarById: index.calendarById,
  }
  const lastmod = snapshot.generatedAt.slice(0, 10)
  const entries: SitemapEntry[] = [{ loc: `${site}/`, lastmod }]
  const page = async (rel: string, html: string) => {
    await writeText(path.join(outDir, rel, 'index.html'), html)
    entries.push({ loc: `${site}${rel}`, lastmod })
  }

  await page('/centres/', centresIndexPage(centres, ctx))
  await page('/activities/', activitiesIndexPage(centres, byCentre, ctx))
  for (const centre of centres) {
    await page(centrePagePath(centre.id), centrePage(centre, byCentre.get(centre.id) ?? [], ctx))
  }
  const batch = 64
  for (let i = 0; i < snapshot.activities.length; i += batch) {
    await Promise.all(
      snapshot.activities.slice(i, i + batch).map((activity) => {
        const detail = buildActivityDetail(
          index,
          activity,
          byActivity.get(activity.id) ?? [],
          today,
          site,
        )
        return page(activityPagePath(activity.id), activityPage(detail, ctx))
      }),
    )
  }
  return entries
}

export async function generateSite(options: SiteOptions): Promise<SiteReport> {
  const shards = await writeShards(options)
  const entries = await writePages(options)
  await writeText(path.join(options.outDir, 'sitemap.xml'), sitemapXml(entries))
  return { files: shards.length + entries.length }
}
