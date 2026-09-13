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
import { buildSiteMeta } from './src/data/catalog.ts'
import { datasetNode, jsonLdScript, webSiteNode } from './src/data/jsonld.ts'
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
    /**
     * Give the app shell structured data and no-JS links to the prerendered pages, so crawlers
     * that do not run the app still learn what the site is and where the content lives.
     */
    async transformIndexHtml(html) {
      const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
      const meta = buildSiteMeta(await readSnapshotFiles(dataDir), pkg.version)
      const jsonLd = jsonLdScript([webSiteNode(), datasetNode(meta)])
      const noscript =
        '<noscript><p>covac needs JavaScript for the calendar. Browse the static pages instead: ' +
        '<a href="/activities/">all activities</a> or <a href="/centres/">recreation centres</a>.</p></noscript>'
      return html
        .replace('</head>', `    ${jsonLd}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`)
    },
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
