/** SEP-1960 discovery manifest at /.well-known/mcp (a Function because /.well-known/mcp/ is a directory). */
import { manifest } from '../../mcp/discovery.ts'
import { ALLOWED_HOSTNAME } from '../../mcp/handler.ts'

export const onRequestGet: PagesFunction = ({ request }) => {
  const url = new URL(request.url)
  if (!ALLOWED_HOSTNAME.test(url.hostname)) return new Response('Not found', { status: 404 })
  return new Response(JSON.stringify(manifest(url.origin), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
