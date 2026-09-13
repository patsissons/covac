import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { generateSite } from './scripts/site/build.ts'
import {
  bundleSnapshot,
  COLLECTIONS,
  collectionFile,
  readSnapshotFiles,
} from './scripts/snapshot/files.ts'
import { vancouverToday } from './src/data/tz.ts'

/**
 * Merge the committed `public/data/snapshot.*.json` files into the single minified
 * `snapshot.json` the app fetches. `buildStart` runs before Vite copies `public/` (and at dev
 * server start); `closeBundle` drops the pretty split files from the build output and then
 * generates the machine-readable site (data shards and friends, see `scripts/site/build.ts`)
 * into it. Those generated files exist only in `dist/`, never in `public/`.
 */
function snapshotBundle(): Plugin {
  let isBuild = false
  let outDir = 'dist'
  let dataDir = 'public/data'
  return {
    name: 'covac:snapshot-bundle',
    configResolved(config) {
      isBuild = config.command === 'build'
      outDir = config.build.outDir
      dataDir = path.join(config.publicDir, 'data')
    },
    buildStart: () => bundleSnapshot(dataDir),
    async closeBundle() {
      if (!isBuild) return
      await Promise.all(
        COLLECTIONS.map((name) =>
          rm(path.join(outDir, 'data', collectionFile(name)), { force: true }),
        ),
      )
      const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
      const report = await generateSite({
        snapshot: await readSnapshotFiles(dataDir),
        outDir,
        version: pkg.version,
        today: vancouverToday(),
      })
      this.info(`generated ${report.files} machine-readable files`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), snapshotBundle()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
