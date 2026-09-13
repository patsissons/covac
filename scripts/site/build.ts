/**
 * Generate everything derived from the snapshot for machine readers into the build output:
 * data shards now; prerendered pages, llms.txt and discovery documents are added by later steps.
 * Runs from the Vite plugin's `closeBundle` and from `pnpm site:generate`.
 */
import type { DateString } from '../../src/data/dates.ts'
import type { Snapshot } from '../../src/types/snapshot.ts'
import { writeShards } from './shards.ts'

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

export async function generateSite(options: SiteOptions): Promise<SiteReport> {
  const shards = await writeShards(options)
  return { files: shards.length }
}
