/** Write the MCP server card (SEP-1649) so its tool list always mirrors the deployed server. */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { serverCard } from '../../mcp/discovery.ts'

export const SERVER_CARD_PATH = '/.well-known/mcp/server-card.json'

export async function writeServerCard(options: {
  outDir: string
  site: string
  version: string
  period: { start: string; end: string }
}): Promise<string> {
  const file = path.join(options.outDir, SERVER_CARD_PATH)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(
    file,
    JSON.stringify(serverCard(options.site, options.version, options.period), null, 2) + '\n',
  )
  return SERVER_CARD_PATH
}
