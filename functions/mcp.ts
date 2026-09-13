/** Cloudflare Pages Function serving the MCP endpoint at /mcp. */
import { handleMcp } from '../mcp/handler.ts'
import type { Env } from '../mcp/env.ts'

export const onRequest: PagesFunction<Env> = (context) => handleMcp(context.request, context.env)
