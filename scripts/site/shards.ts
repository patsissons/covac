/**
 * Write the compact data shards under `<outDir>/data/` (see `src/data/catalog.ts` for why they
 * exist). Every file is minified JSON; the per-activity files let a reader fetch one activity
 * without parsing the catalog.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  buildSiteMeta,
  buildWeekShards,
  occurrencesByActivity,
} from '../../src/data/catalog.ts'
import type { DateString } from '../../src/data/dates.ts'
import { buildIndex } from '../../src/data/index.ts'
import type { Snapshot } from '../../src/types/snapshot.ts'

export const SHARD_FILES = {
  meta: 'data/meta.json',
  calendars: 'data/calendars.json',
  centres: 'data/centres.json',
  catalog: 'data/catalog.json',
  week: (monday: DateString) => `data/weeks/${monday}.json`,
  activity: (id: number) => `data/activities/${id}.json`,
} as const

export interface ShardOptions {
  snapshot: Snapshot
  outDir: string
  version: string
  /** Today's date in Vancouver, used to pick each activity's "next" session for links. */
  today: DateString
  /** Origin for absolute URLs inside the shards. */
  site?: string
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value))
}

/** Every shard as relative path → value, in the order they are written. */
export function buildShardMap(options: Omit<ShardOptions, 'outDir'>): Map<string, unknown> {
  const { snapshot, version, today, site } = options
  const index = buildIndex(snapshot)
  const byActivity = occurrencesByActivity(snapshot.occurrences)
  const shards = new Map<string, unknown>()
  shards.set(SHARD_FILES.meta, buildSiteMeta(snapshot, version))
  shards.set(SHARD_FILES.calendars, snapshot.calendars)
  shards.set(SHARD_FILES.centres, buildCentres(snapshot))
  shards.set(SHARD_FILES.catalog, buildCatalog(snapshot))
  for (const week of buildWeekShards(snapshot)) shards.set(SHARD_FILES.week(week.week), week)
  for (const activity of snapshot.activities) {
    shards.set(
      SHARD_FILES.activity(activity.id),
      buildActivityDetail(index, activity, byActivity.get(activity.id) ?? [], today, site),
    )
  }
  return shards
}

/** Write every shard; returns the relative paths written. */
export async function writeShards(options: ShardOptions): Promise<string[]> {
  const entries = [...buildShardMap(options).entries()]
  // Thousands of small files: write in batches so we neither serialise nor exhaust descriptors.
  const batch = 64
  for (let i = 0; i < entries.length; i += batch) {
    await Promise.all(
      entries
        .slice(i, i + batch)
        .map(([rel, value]) => writeJson(path.join(options.outDir, rel), value)),
    )
  }
  return entries.map(([rel]) => rel)
}
