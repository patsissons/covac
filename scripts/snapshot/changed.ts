// Exit 0 when the split snapshot files under public/data differ from the committed versions in
// anything other than meta's generatedAt, exit 1 otherwise. The scrape workflow uses it to avoid
// no-op commits.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { COLLECTIONS, META_FILE, collectionFile } from './files'

const DIR = 'public/data'
const FILES = [META_FILE, ...COLLECTIONS.map(collectionFile)]

function normalize(file: string, text: string): string {
  if (file !== META_FILE) return text
  const meta = JSON.parse(text) as Record<string, unknown>
  delete meta.generatedAt
  return JSON.stringify(meta)
}

function committed(file: string): string | undefined {
  try {
    return execFileSync('git', ['show', `HEAD:${DIR}/${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch {
    return undefined
  }
}

const changed = FILES.filter((file) => {
  const head = committed(file)
  if (head === undefined) {
    console.log(`${DIR}/${file} is not committed yet`)
    return true
  }
  return normalize(file, head) !== normalize(file, readFileSync(`${DIR}/${file}`, 'utf8'))
})

console.log(
  changed.length ? `snapshot data changed: ${changed.join(', ')}` : 'snapshot data unchanged',
)
process.exit(changed.length ? 0 : 1)
