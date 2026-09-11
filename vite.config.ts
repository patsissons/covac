import { rm } from 'node:fs/promises'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { bundleSnapshot, COLLECTIONS, collectionFile } from './scripts/snapshot/files.ts'

/**
 * Merge the committed `public/data/snapshot.*.json` files into the single minified
 * `snapshot.json` the app fetches. `buildStart` runs before Vite copies `public/` (and at dev
 * server start), and `closeBundle` drops the pretty split files from the build output.
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
