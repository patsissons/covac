import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import pLimit from 'p-limit'
import type { RawActivityDetail } from './api'
import type { Client } from './client'
import type { Snapshot } from '../../src/types/snapshot'

export interface EnrichOptions {
  client: Client
  snapshot: Snapshot
  concurrency?: number
  /** Directory for per-activity JSON cache; omit to disable caching. */
  cacheDir?: string
  /** Only enrich the first N activities (for quick local runs). */
  limit?: number
  log?: (message: string) => void
}

/**
 * Fetch activity details for every activity in the snapshot. Individual failures are logged
 * and skipped so a flaky upstream never blocks the bulk data.
 */
export async function fetchActivityDetails({
  client,
  snapshot,
  concurrency = 4,
  cacheDir,
  limit,
  log = () => {},
}: EnrichOptions): Promise<Map<number, RawActivityDetail>> {
  const firstStart = new Map<number, string>()
  for (const o of snapshot.occurrences) {
    if (!firstStart.has(o.a)) firstStart.set(o.a, o.s)
  }
  const activities = limit ? snapshot.activities.slice(0, limit) : snapshot.activities
  const details = new Map<number, RawActivityDetail>()
  const run = pLimit(concurrency)
  let done = 0
  let failed = 0
  if (cacheDir) await mkdir(cacheDir, { recursive: true })

  await Promise.all(
    activities.map((activity) =>
      run(async () => {
        const cacheFile = cacheDir ? path.join(cacheDir, `${activity.id}.json`) : undefined
        try {
          const cached = cacheFile ? await readCache(cacheFile) : undefined
          if (cached) {
            details.set(activity.id, cached)
            return
          }
          // The API wants the raw `YYYY-MM-DD HH:mm:ss` form of one session's start.
          const start = firstStart.get(activity.id) ?? `${snapshot.period.start}T00:00`
          const selectedDate = `${start.replace('T', ' ')}:00`
          const { activity_detail } = await client.activityDetail(activity.id, selectedDate)
          details.set(activity.id, activity_detail)
          if (cacheFile) await writeFile(cacheFile, JSON.stringify(activity_detail))
        } catch (error) {
          failed++
          log(`detail ${activity.id} failed: ${error instanceof Error ? error.message : error}`)
        } finally {
          done++
          if (done % 250 === 0 || done === activities.length)
            log(`details ${done}/${activities.length} (${failed} failed)`)
        }
      }),
    ),
  )
  return details
}

async function readCache(file: string): Promise<RawActivityDetail | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as RawActivityDetail
  } catch {
    return undefined
  }
}
