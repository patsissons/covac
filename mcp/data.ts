/**
 * Reads the data shards the build writes under `/data/` through the Pages `ASSETS` binding and
 * caches the parsed results for the life of the isolate. Isolates are recycled on every deploy,
 * and a deploy is the only way the data changes, so the cache never goes stale.
 *
 * Budget: the Workers free plan allows 10 ms of CPU per request. The catalog parses in ~3 ms,
 * a week of sessions in ~0.3 ms and one activity in well under a millisecond, so a cold request
 * that reads the catalog plus a couple of weeks stays comfortably inside it.
 */
import type {
  ActivityDetail,
  Catalog,
  CentresShard,
  SiteMeta,
  WeekShard,
} from '../src/data/catalog.ts'
import type { DateString } from '../src/data/dates.ts'
import { buildSearchContext, type SearchContext } from '../src/data/search.ts'
import type { Calendar } from '../src/types/snapshot.ts'
import type { Assets } from './env.ts'

/** Parsed shards by path, shared across requests in this isolate. */
const cache = new Map<string, Promise<unknown>>()
/** Per-activity files are many; keep only the most recently used ones. */
const ACTIVITY_CACHE_LIMIT = 256
let activityKeys: string[] = []

/** Drop everything cached; tests use this between cases. */
export function resetShardCache(): void {
  cache.clear()
  activityKeys = []
}

export class Shards {
  private readonly assets: Assets
  private readonly origin: string

  constructor(assets: Assets, origin: string) {
    this.assets = assets
    this.origin = origin
  }

  private load<T>(path: string, bounded = false): Promise<T> {
    let pending = cache.get(path) as Promise<T> | undefined
    if (!pending) {
      pending = this.assets
        .fetch(new URL(path, this.origin))
        .then((response) => {
          if (response.status === 404) return undefined as T
          if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
          return response.json() as Promise<T>
        })
        .catch((error: unknown) => {
          cache.delete(path)
          throw error
        })
      cache.set(path, pending)
      if (bounded) {
        activityKeys.push(path)
        if (activityKeys.length > ACTIVITY_CACHE_LIMIT) {
          const evicted = activityKeys.shift()
          if (evicted) cache.delete(evicted)
        }
      }
    }
    return pending
  }

  meta(): Promise<SiteMeta> {
    return this.load('/data/meta.json')
  }

  calendars(): Promise<Calendar[]> {
    return this.load('/data/calendars.json')
  }

  centres(): Promise<CentresShard> {
    return this.load('/data/centres.json')
  }

  catalog(): Promise<Catalog> {
    return this.load('/data/catalog.json')
  }

  /** Sessions in the week starting on `monday`; empty when the snapshot has none. */
  async week(monday: DateString): Promise<WeekShard> {
    const shard = await this.load<WeekShard | undefined>(`/data/weeks/${monday}.json`)
    return shard ?? { week: monday, occurrences: [] }
  }

  /** One activity in full, or undefined when the id is not in the snapshot. */
  activity(id: number): Promise<ActivityDetail | undefined> {
    return this.load(`/data/activities/${id}.json`, true)
  }

  /** Lookup maps over the catalog, built once per isolate alongside the catalog itself. */
  searchContext(): Promise<SearchContext> {
    const key = 'derived:searchContext'
    let pending = cache.get(key) as Promise<SearchContext> | undefined
    if (!pending) {
      pending = Promise.all([this.catalog(), this.centres(), this.calendars()]).then(
        ([catalog, centres, calendars]) =>
          buildSearchContext(catalog.activities, centres.centres, calendars),
      )
      cache.set(key, pending)
      pending.catch(() => cache.delete(key))
    }
    return pending
  }
}
