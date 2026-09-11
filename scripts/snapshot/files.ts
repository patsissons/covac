/**
 * On-disk layout of the snapshot under `public/data/`.
 *
 * The scraper commits one pretty-printed JSON file per collection plus `snapshot.meta.json`, so
 * nightly commits show real line changes. The Vite build merges them into the single minified
 * `snapshot.json` the app fetches; that bundle is gitignored.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Snapshot, SnapshotMeta } from '../../src/types/snapshot.ts'

export const COLLECTIONS = [
  'calendars',
  'centers',
  'facilities',
  'activities',
  'occurrences',
] as const
export type Collection = (typeof COLLECTIONS)[number]

export const META_FILE = 'snapshot.meta.json'
export const BUNDLE_FILE = 'snapshot.json'
export const collectionFile = (name: Collection) => `snapshot.${name}.json`

/**
 * Pretty-print a collection for git. Occurrences are one row per line (17k tiny objects, so a
 * changed session is a one-line diff); everything else uses standard two-space indentation.
 */
export function formatCollection(name: Collection, rows: readonly unknown[]): string {
  if (name !== 'occurrences') return JSON.stringify(rows, null, 2) + '\n'
  if (rows.length === 0) return '[]\n'
  return '[\n' + rows.map((row) => '  ' + JSON.stringify(row)).join(',\n') + '\n]\n'
}

/** Write `snapshot.meta.json` and one file per collection into `dir`. */
export async function writeSnapshotFiles(
  dir: string,
  snapshot: Snapshot,
  meta: SnapshotMeta,
): Promise<void> {
  await writeFile(path.join(dir, META_FILE), JSON.stringify(meta, null, 2) + '\n')
  for (const name of COLLECTIONS) {
    await writeFile(path.join(dir, collectionFile(name)), formatCollection(name, snapshot[name]))
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

/** Merge the split files back into a `Snapshot`, taking `generatedAt` and `period` from meta. */
export async function readSnapshotFiles(dir: string): Promise<Snapshot> {
  const meta = await readJson<SnapshotMeta>(path.join(dir, META_FILE))
  // Key order matches the historical bundle so the output is byte-identical.
  const snapshot = { generatedAt: meta.generatedAt, period: meta.period } as Snapshot
  for (const name of COLLECTIONS) {
    snapshot[name] = await readJson<never>(path.join(dir, collectionFile(name)))
  }
  return snapshot
}

/** Write the minified single-line bundle the app fetches at runtime. */
export async function bundleSnapshot(
  dir: string,
  outFile = path.join(dir, BUNDLE_FILE),
): Promise<void> {
  await writeFile(outFile, JSON.stringify(await readSnapshotFiles(dir)))
}
