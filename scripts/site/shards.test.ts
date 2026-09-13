import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { snapshot } from '../../src/test/fixture.ts'
import type { ActivityDetail, Catalog, SiteMeta, WeekShard } from '../../src/data/catalog.ts'
import { generateSite } from './build.ts'
import { SHARD_FILES, writeShards } from './shards.ts'

let dir: string
let written: string[]

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'covac-shards-'))
  written = await writeShards({ snapshot, outDir: dir, version: '9.9.9', today: '2026-09-08' })
})
afterAll(() => rm(dir, { recursive: true, force: true }))

const read = async <T>(rel: string) => JSON.parse(await readFile(path.join(dir, rel), 'utf8')) as T

describe('writeShards', () => {
  it('writes meta, catalog, centres, calendars, one file per week and per activity', async () => {
    expect(written).toEqual([
      'data/meta.json',
      'data/calendars.json',
      'data/centres.json',
      'data/catalog.json',
      'data/weeks/2026-09-07.json',
      'data/activities/1.json',
      'data/activities/2.json',
    ])
    expect(await readdir(path.join(dir, 'data', 'activities'))).toEqual(['1.json', '2.json'])
  })

  it('writes minified JSON with the expected shapes', async () => {
    const raw = await readFile(path.join(dir, SHARD_FILES.catalog), 'utf8')
    expect(raw).not.toContain('\n')
    const meta = await read<SiteMeta>(SHARD_FILES.meta)
    expect(meta.version).toBe('9.9.9')
    expect(meta.weeks).toEqual(['2026-09-07'])
    const catalog = await read<Catalog>(SHARD_FILES.catalog)
    expect(catalog.activities.map((a) => a.id)).toEqual([1, 2])
    const week = await read<WeekShard>(SHARD_FILES.week('2026-09-07'))
    expect(week.occurrences).toEqual(snapshot.occurrences)
    const detail = await read<ActivityDetail>(SHARD_FILES.activity(1))
    expect(detail.descriptionText).toBe('Recreational swim for everyone.')
    expect(detail.sessions).toHaveLength(2)
    expect(detail.link).toBe('https://covac.fyi/?week=2026-09-07&centers=37&q=Free+Swim')
  })
})

describe('generateSite', () => {
  it('reports the number of files written', async () => {
    const out = await mkdtemp(path.join(os.tmpdir(), 'covac-site-'))
    try {
      const report = await generateSite({
        snapshot,
        outDir: out,
        version: '0',
        today: '2026-09-08',
      })
      // 7 shards + home, two indexes, two centre pages and two activity pages in the sitemap.
      expect(report.files).toBe(14)
      const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8')
      expect(sitemap).toContain('<loc>https://covac.fyi/activities/2/</loc>')
      expect(sitemap).toContain('<loc>https://covac.fyi/centres/44/</loc>')
      await readFile(path.join(out, 'activities', '1', 'index.html'), 'utf8')
      await readFile(path.join(out, 'centres', 'index.html'), 'utf8')
    } finally {
      await rm(out, { recursive: true, force: true })
    }
  })
})
