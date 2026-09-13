/**
 * HTTP entry point for the MCP endpoint. Validates the hostname and any browser Origin, adds
 * permissive CORS (the data is public and there is no auth), then hands the request to the
 * SDK's stateless handler, which serves 2026-07-28 clients natively and 2025-era clients through
 * its stateless legacy fallback.
 */
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server'
import { vancouverToday } from '../src/data/tz.ts'
import { Shards } from './data.ts'
import type { Assets, Env } from './env.ts'
import { createServer } from './server.ts'

/** Hosts this deployment answers on: production, Pages previews and local development. */
export const ALLOWED_HOSTNAME =
  /^(covac\.fyi|www\.covac\.fyi|covac\.pages\.dev|[a-z0-9-]+\.covac\.pages\.dev|localhost|127\.0\.0\.1|\[::1\])$/

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

/** One SDK handler per ASSETS binding (in practice one per isolate). */
const handlers = new WeakMap<Assets, McpHttpHandler>()

function handlerFor(assets: Assets): McpHttpHandler {
  let handler = handlers.get(assets)
  if (!handler) {
    handler = createMcpHandler(
      (ctx) => {
        const origin = new URL(ctx.requestInfo?.url ?? 'https://covac.fyi/').origin
        return createServer({
          shards: new Shards(assets, origin),
          site: origin,
          today: vancouverToday(),
        })
      },
      { legacy: 'stateless', responseMode: 'auto' },
    )
    handlers.set(assets, handler)
  }
  return handler
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** A present Origin must at least be a well-formed origin; browsers send `null` for opaque ones. */
function originIsWellFormed(origin: string | null): boolean {
  if (origin === null || origin === '') return true
  try {
    const url = new URL(origin)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === origin
  } catch {
    return false
  }
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (!ALLOWED_HOSTNAME.test(url.hostname)) return new Response('Not found', { status: 404 })
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (!originIsWellFormed(request.headers.get('origin'))) {
    return withCors(new Response('Invalid Origin header', { status: 403 }))
  }
  return withCors(await handlerFor(env.ASSETS).fetch(request))
}
