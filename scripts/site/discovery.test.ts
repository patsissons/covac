import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { manifest, serverCard } from '../../mcp/discovery.ts'
import { TOOLS } from '../../mcp/tools/index.ts'
import { writeServerCard } from './discovery.ts'

describe('serverCard', () => {
  const card = serverCard('https://covac.fyi', '1.2.3', { start: '2026-09-06', end: '2026-11-01' })

  it('mirrors the server and its tools', () => {
    expect(card).toMatchObject({
      protocolVersion: '2026-07-28',
      serverInfo: { name: 'covac', version: '1.2.3' },
      transport: { type: 'streamable-http', endpoint: 'https://covac.fyi/mcp' },
      authentication: { required: false },
      documentationUrl: 'https://covac.fyi/llms.txt',
    })
    expect(card.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name))
    for (const tool of card.tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
      expect(tool.annotations.readOnlyHint).toBe(true)
    }
    expect(card.resources.map((r) => r.uri)).toContain('covac://centres')
    expect(card.prompts[0]!.name).toBe('plan_activities')
    expect(card.instructions).toContain('2026-09-06 to 2026-11-01')
  })

  it('has a JSON schema for find_activities with described filters', () => {
    const find = card.tools.find((t) => t.name === 'find_activities')!
    const schema = find.inputSchema as { properties: Record<string, { description?: string }> }
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        'query',
        'group',
        'centerIds',
        'dateFrom',
        'dateTo',
        'priceMax',
        'age',
      ]),
    )
    expect(schema.properties.dateFrom!.description).toContain('today')
  })
})

describe('manifest', () => {
  it('points at the endpoint and the card', () => {
    expect(manifest('https://covac.fyi')).toMatchObject({
      mcp_version: '2026-07-28',
      endpoints: { streamable_http: 'https://covac.fyi/mcp' },
      server_card: 'https://covac.fyi/.well-known/mcp/server-card.json',
    })
  })
})

describe('writeServerCard', () => {
  it('writes pretty JSON under .well-known', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'covac-card-'))
    try {
      const rel = await writeServerCard({
        outDir: dir,
        site: 'https://covac.fyi',
        version: '0',
        period: { start: '2026-09-06', end: '2026-11-01' },
      })
      expect(rel).toBe('/.well-known/mcp/server-card.json')
      const text = await readFile(path.join(dir, rel), 'utf8')
      expect(text).toContain('\n')
      expect(JSON.parse(text).serverInfo.name).toBe('covac')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
