// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { buildShardMap } from '../scripts/site/shards.ts'
import { snapshot } from '../src/test/fixture.ts'
import { resetShardCache } from './data.ts'
import { handleMcp } from './handler.ts'
import { fakeAssets } from './testing.ts'
import { TOOLS } from './tools/index.ts'

const ORIGIN = 'http://localhost:8788'
const ENVELOPE = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'vitest', version: '0' },
  'io.modelcontextprotocol/clientCapabilities': {},
}

interface RpcResult {
  jsonrpc: '2.0'
  id: number
  result?: Record<string, unknown> & {
    tools?: { name: string; annotations?: Record<string, unknown> }[]
    content?: { type: string; text: string }[]
    structuredContent?: unknown
    isError?: boolean
  }
  error?: { code: number; message: string }
}

function env() {
  return {
    ASSETS: fakeAssets(
      buildShardMap({ snapshot, version: '0.0.1', today: '2026-09-08', site: ORIGIN }),
    ),
  }
}

/** POST a 2026-07-28 request. */
async function modern(
  method: string,
  params: Record<string, unknown> = {},
  e = env(),
  origin = ORIGIN,
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2026-07-28',
    'mcp-method': method,
  }
  if (typeof params.name === 'string') headers['mcp-name'] = params.name
  if (typeof params.uri === 'string') headers['mcp-name'] = params.uri
  const body = { jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: ENVELOPE } }
  const response = await handleMcp(
    new Request(`${origin}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) }),
    e,
  )
  return { response, json: (await response.json()) as RpcResult }
}

const call = (name: string, args: Record<string, unknown> = {}, e = env()) =>
  modern('tools/call', { name, arguments: args }, e)

const parsedText = (json: RpcResult) => JSON.parse(json.result!.content![0]!.text) as unknown

beforeEach(resetShardCache)

describe('transport', () => {
  it('rejects unknown hosts and answers CORS preflights', async () => {
    const e = env()
    const bad = await handleMcp(new Request('https://evil.example/mcp', { method: 'POST' }), e)
    expect(bad.status).toBe(404)
    const preflight = await handleMcp(new Request(`${ORIGIN}/mcp`, { method: 'OPTIONS' }), e)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Mcp-Method')
  })

  it('rejects a malformed Origin but allows any well-formed one', async () => {
    const e = env()
    const rejected = await handleMcp(
      new Request(`${ORIGIN}/mcp`, { method: 'POST', headers: { origin: 'null' } }),
      e,
    )
    expect(rejected.status).toBe(403)
    const { response } = await modern('server/discover', {}, e)
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('serves 2025-era clients through the stateless legacy path', async () => {
    const response = await handleMcp(
      new Request(`${ORIGIN}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'old', version: '1' },
          },
        }),
      }),
      env(),
    )
    expect(response.status).toBe(200)
    // The legacy path answers over SSE; the result is the single data: line.
    const body = await response.text()
    const data = body.split('\n').find((line) => line.startsWith('data: '))
    expect(data).toBeDefined()
    const json = JSON.parse(data!.slice('data: '.length)) as RpcResult
    expect(json.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'covac' },
    })
  })
})

describe('server/discover and tools/list', () => {
  it('identifies the server and lists tools in a fixed order, all read-only', async () => {
    const { json: discover } = await modern('server/discover')
    expect(discover.result).toMatchObject({
      supportedVersions: ['2026-07-28'],
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'covac', version: '0.0.1' } },
    })
    const { json } = await modern('tools/list')
    expect(json.result!.tools!.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name))
    expect(json.result!.tools!.map((t) => t.name)).toEqual([
      'search',
      'fetch',
      'find_activities',
      'get_activity',
      'list_centres',
      'list_calendars',
      'get_schedule',
      'snapshot_info',
    ])
    for (const tool of json.result!.tools!) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    }
    expect(json.result).toMatchObject({ ttlMs: 3_600_000, cacheScope: 'public' })
  })
})

describe('search and fetch (ChatGPT contract)', () => {
  it('search returns ids, titles and page URLs as structured content and JSON text', async () => {
    const { json } = await call('search', { query: 'swim' })
    const structured = json.result!.structuredContent as {
      results: { id: string; title: string; url: string }[]
    }
    expect(structured.results).toEqual([
      {
        id: '1',
        title: 'Free Swim — Britannia Pool (Public Swimming, Free)',
        url: `${ORIGIN}/activities/1/`,
      },
    ])
    expect(parsedText(json)).toEqual(structured)
  })

  it('fetch returns the document with metadata, and an error for unknown ids', async () => {
    const { json } = await call('fetch', { id: '2' })
    const doc = json.result!.structuredContent as Record<string, unknown>
    expect(doc).toMatchObject({
      id: '2',
      title: 'Basketball Drop-in',
      url: `${ORIGIN}/activities/2/`,
      metadata: { centre: 'Hastings Community Centre', price: 'from $5.00', sessionCount: 1 },
    })
    expect(doc.text).toContain('# Basketball Drop-in')
    expect(parsedText(json)).toEqual(doc)
    const { json: missing } = await call('fetch', { id: '999' })
    expect(missing.result!.isError).toBe(true)
    expect(missing.result!.content![0]!.text).toContain('No activity with id 999')
  })
})

describe('domain tools', () => {
  it('find_activities filters sessions and links to the calendar', async () => {
    const { json } = await call('find_activities', {
      dateFrom: '2026-09-07',
      dateTo: '2026-09-13',
      freeOnly: true,
    })
    const out = json.result!.structuredContent as {
      total: number
      link: string
      results: { id: number; sessionCount: number }[]
    }
    expect(out.total).toBe(1)
    expect(out.results[0]).toMatchObject({ id: 1, sessionCount: 2 })
    expect(out.link).toBe(`${ORIGIN}/?week=2026-09-07`)
    expect(json.result!.content![0]!.text).toContain('Free Swim — Britannia Pool')
  })

  it('find_activities reports availability and can hide unavailable activities', async () => {
    const all = await call('find_activities', { dateFrom: '2026-09-07', dateTo: '2026-09-13' })
    const results = (
      all.json.result!.structuredContent as {
        results: { id: number; availability?: string; spaces?: number }[]
      }
    ).results
    expect(results.map((r) => [r.id, r.availability, r.spaces])).toEqual([
      [1, 'open', 100],
      [2, 'full', 0],
    ])
    const { json } = await call('find_activities', {
      dateFrom: '2026-09-07',
      dateTo: '2026-09-13',
      availableOnly: true,
    })
    const out = json.result!.structuredContent as { link: string; results: { id: number }[] }
    expect(out.results.map((r) => r.id)).toEqual([1])
    expect(out.link).toBe(`${ORIGIN}/?week=2026-09-07&open=1`)
  })

  it('find_activities resolves groups, clamps the range and rejects unknown groups', async () => {
    const { json } = await call('find_activities', {
      group: 'sports',
      dateFrom: '2026-08-01',
      dateTo: '2026-12-31',
    })
    const out = json.result!.structuredContent as {
      range: { from: string; to: string }
      note?: string
      results: { id: number }[]
    }
    expect(out.range).toEqual({ from: '2026-09-06', to: '2026-10-31' })
    expect(out.note).toContain('clamped')
    expect(out.results.map((r) => r.id)).toEqual([2])
    const { json: bad } = await call('find_activities', { group: 'Knitting' })
    expect(bad.result!.isError).toBe(true)
  })

  it('get_activity returns the full record with offsets', async () => {
    const { json } = await call('get_activity', { id: 1 })
    const out = json.result!.structuredContent as {
      sessions: { startIso: string }[]
      activenetUrl: string
      centre: { name: string }
      availability?: string
      spaces?: number
    }
    expect(out.centre.name).toBe('Britannia Pool')
    expect(out.availability).toBe('open')
    expect(out.spaces).toBe(100)
    expect(out.sessions[0]!.startIso).toBe('2026-09-07T07:00:00-07:00')
    expect(out.activenetUrl).toBe('https://example.com/free-swim/1')
    expect(json.result!.content![0]!.text).toContain('# Free Swim')
  })

  it('get_schedule groups a day by centre', async () => {
    const { json } = await call('get_schedule', { date: '2026-09-12' })
    const out = json.result!.structuredContent as {
      total: number
      centres: { name: string; sessions: { title: string }[] }[]
    }
    expect(out.total).toBe(1)
    expect(out.centres[0]).toMatchObject({ name: 'Hastings Community Centre' })
    expect(out.centres[0]!.sessions[0]!.title).toBe('Basketball Drop-in')
    const { json: outside } = await call('get_schedule', { date: '2027-01-01' })
    expect(outside.result!.isError).toBe(true)
  })

  it('list_centres, list_calendars and snapshot_info describe the catalog', async () => {
    const e = env()
    const { json: centres } = await call('list_centres', {}, e)
    expect(
      (centres.result!.structuredContent as { centres: { name: string }[] }).centres.map(
        (c) => c.name,
      ),
    ).toEqual(['Britannia Pool', 'Hastings Community Centre'])
    const { json: calendars } = await call('list_calendars', {}, e)
    expect((calendars.result!.structuredContent as { groups: string[] }).groups).toEqual([
      'Drop-in',
      'Sports',
    ])
    const { json: info } = await call('snapshot_info', {}, e)
    expect(info.result!.structuredContent).toMatchObject({
      period: snapshot.period,
      counts: { activities: 2, occurrences: 3 },
      links: { llms: `${ORIGIN}/llms.txt` },
    })
  })
})

describe('resources and prompts', () => {
  it('lists and reads resources', async () => {
    const e = env()
    const { json: list } = await modern('resources/list', {}, e)
    expect((list.result!.resources as { uri: string }[]).map((r) => r.uri)).toEqual([
      'covac://snapshot',
      'covac://centres',
      'covac://calendars',
    ])
    const { json: read } = await modern('resources/read', { uri: 'covac://calendars' }, e)
    const contents = read.result!.contents as { text: string }[]
    expect(JSON.parse(contents[0]!.text)).toEqual(snapshot.calendars)
    const { json: activity } = await modern('resources/read', { uri: 'covac://activities/1' }, e)
    expect((activity.result!.contents as { text: string }[])[0]!.text).toContain('# Free Swim')
  })

  it('renders the planning prompt', async () => {
    const { json } = await modern('prompts/get', {
      name: 'plan_activities',
      arguments: { when: 'Saturday' },
    })
    const messages = json.result!.messages as { content: { text: string } }[]
    expect(messages[0]!.content.text).toContain('Saturday')
    expect(messages[0]!.content.text).toContain('find_activities')
  })
})

describe('shard cache', () => {
  it('fetches each shard once per isolate', async () => {
    const e = env()
    await call('list_centres', {}, e)
    await call('list_centres', {}, e)
    expect(e.ASSETS.requests.filter((p) => p === '/data/centres.json')).toHaveLength(1)
  })
})
