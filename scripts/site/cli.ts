/**
 * Regenerate the derived site files into an existing `dist/` without rebuilding the React app:
 * `pnpm site:generate [--out dist] [--data public/data]`.
 */
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { vancouverToday } from '../../src/data/tz.ts'
import { readSnapshotFiles } from '../snapshot/files.ts'
import { generateSite } from './build.ts'

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'dist' },
    data: { type: 'string', default: 'public/data' },
  },
})

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
const snapshot = await readSnapshotFiles(values.data)
const report = await generateSite({
  snapshot,
  outDir: values.out,
  version: pkg.version,
  today: vancouverToday(),
})
console.log(`Wrote ${report.files} generated files to ${values.out}`)
