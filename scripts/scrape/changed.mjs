// Exit 0 when public/data/snapshot.json differs from the committed version in anything other
// than generatedAt, exit 1 otherwise. Used by the scrape workflow to avoid no-op commits.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FILE = 'public/data/snapshot.json'

function normalize(text) {
  const snapshot = JSON.parse(text)
  delete snapshot.generatedAt
  return JSON.stringify(snapshot)
}

let committed
try {
  committed = execFileSync('git', ['show', `HEAD:${FILE}`], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
} catch {
  console.log(`${FILE} is not committed yet`)
  process.exit(0)
}

const changed = normalize(committed) !== normalize(readFileSync(FILE, 'utf8'))
console.log(changed ? 'snapshot data changed' : 'snapshot data unchanged')
process.exit(changed ? 0 : 1)
