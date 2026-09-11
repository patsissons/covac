import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Snapshot, SnapshotMeta } from '../../src/types/snapshot'
import {
  BUNDLE_FILE,
  COLLECTIONS,
  META_FILE,
  bundleSnapshot,
  collectionFile,
  formatCollection,
  readSnapshotFiles,
  writeSnapshotFiles,
} from './files'

const snapshot: Snapshot = {
  generatedAt: '2026-09-09T02:00:00.000Z',
  period: { start: '2026-09-06', end: '2026-11-01' },
  calendars: [{ id: 55, name: 'Public Swimming', group: 'Drop-in' }],
  centers: [{ id: 37, name: 'Britannia Pool', lat: 49.2756, lng: -123.0707 }],
  facilities: [{ id: 207, name: 'Britannia Pool', centerId: 37 }],
  activities: [
    {
      id: 1,
      title: 'Free Swim',
      calendarId: 55,
      centerId: 37,
      facilityIds: [207],
      url: 'https://example.com/free-swim/1',
      description: '<p>Recreational swim for <b>everyone</b>.</p>',
      instructors: ['Ada Lovelace'],
      priceText: 'Free',
      free: true,
      prices: [{ price: '$0.00', description: 'Drop-in' }],
    },
  ],
  occurrences: [
    { a: 1, s: '2026-09-07T07:00', e: '2026-09-07T08:00' },
    { a: 1, s: '2026-09-08T14:00', e: '2026-09-08T16:00' },
  ],
}

const meta: SnapshotMeta = {
  generatedAt: snapshot.generatedAt,
  period: snapshot.period,
  counts: {
    calendars: snapshot.calendars.length,
    centers: snapshot.centers.length,
    activities: snapshot.activities.length,
    occurrences: snapshot.occurrences.length,
    enriched: 1,
  },
}

describe('formatCollection', () => {
  it('pretty-prints entity collections with two-space indentation', () => {
    expect(formatCollection('calendars', snapshot.calendars)).toBe(
      JSON.stringify(snapshot.calendars, null, 2) + '\n',
    )
  })

  it('writes one occurrence per line', () => {
    const text = formatCollection('occurrences', snapshot.occurrences)
    const lines = text.split('\n')
    expect(lines).toHaveLength(snapshot.occurrences.length + 3) // rows + [ + ] + trailing newline
    expect(lines[0]).toBe('[')
    expect(lines.at(-2)).toBe(']')
    expect(lines.at(-1)).toBe('')
    for (const line of lines.slice(1, -2)) {
      expect(JSON.parse(line.replace(/,$/, ''))).toMatchObject({ a: expect.any(Number) })
    }
    expect(JSON.parse(text)).toEqual(snapshot.occurrences)
  })

  it('formats empty collections as an empty array', () => {
    expect(formatCollection('occurrences', [])).toBe('[]\n')
    expect(formatCollection('centers', [])).toBe('[]\n')
  })
})

describe('snapshot files', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'covac-snapshot-'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('round-trips through the split files preserving key order', async () => {
    await writeSnapshotFiles(dir, snapshot, meta)
    const read = await readSnapshotFiles(dir)
    expect(read).toEqual(snapshot)
    expect(Object.keys(read)).toEqual(Object.keys(snapshot))
  })

  it('keeps generatedAt and period only in the meta file', async () => {
    await writeSnapshotFiles(dir, snapshot, meta)
    const metaText = await readFile(path.join(dir, META_FILE), 'utf8')
    expect(metaText).toBe(JSON.stringify(meta, null, 2) + '\n')
    for (const name of COLLECTIONS) {
      const text = await readFile(path.join(dir, collectionFile(name)), 'utf8')
      expect(text).not.toContain('generatedAt')
      expect(text).not.toContain('"period"')
    }
  })

  it('bundles into a single minified line identical to JSON.stringify of the snapshot', async () => {
    await writeSnapshotFiles(dir, snapshot, meta)
    await bundleSnapshot(dir)
    const bundle = await readFile(path.join(dir, BUNDLE_FILE), 'utf8')
    expect(bundle).not.toContain('\n')
    expect(bundle).toBe(JSON.stringify(snapshot))
  })

  it('bundles to a custom output path', async () => {
    await writeSnapshotFiles(dir, snapshot, meta)
    const out = path.join(dir, 'elsewhere.json')
    await bundleSnapshot(dir, out)
    expect(JSON.parse(await readFile(out, 'utf8'))).toEqual(snapshot)
  })

  it('rejects when a collection file is missing', async () => {
    await writeSnapshotFiles(dir, snapshot, meta)
    await rm(path.join(dir, collectionFile('activities')))
    await expect(readSnapshotFiles(dir)).rejects.toThrow(/snapshot\.activities\.json/)
  })
})
