/**
 * MCP discovery documents. Neither is in the core spec yet, but clients and directories read
 * them: a server card (SEP-1649) at `/.well-known/mcp/server-card.json`, generated at build so
 * its tool list mirrors the server, and a small manifest (SEP-1960) at `/.well-known/mcp`.
 */
import * as z from 'zod'
import {
  PROMPTS,
  RESOURCE_TEMPLATES,
  RESOURCES,
  SERVER_DESCRIPTION,
  SERVER_NAME,
  SERVER_TITLE,
  instructions,
} from './server.ts'
import { TOOLS } from './tools/index.ts'

export const PROTOCOL_VERSION = '2026-07-28'

export function serverCard(site: string, version: string, period: { start: string; end: string }) {
  return {
    $schema: 'https://modelcontextprotocol.io/schemas/server-card/v1.json',
    version: '1.0',
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version, websiteUrl: `${site}/` },
    description: SERVER_DESCRIPTION,
    documentationUrl: `${site}/llms.txt`,
    transport: { type: 'streamable-http', endpoint: `${site}/mcp` },
    authentication: { required: false },
    // Mirrors what the SDK advertises in server/discover.
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
    },
    instructions: instructions(period, 'the date of the request'),
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      title: r.title,
      mimeType: r.mimeType,
    })),
    resourceTemplates: RESOURCE_TEMPLATES.map((r) => ({ ...r })),
    prompts: PROMPTS.map((p) => ({ ...p })),
  }
}

export function manifest(site: string) {
  return {
    mcp_version: PROTOCOL_VERSION,
    name: SERVER_NAME,
    description: SERVER_DESCRIPTION,
    endpoints: { streamable_http: `${site}/mcp` },
    server_card: `${site}/.well-known/mcp/server-card.json`,
    documentation: `${site}/llms.txt`,
    capabilities: { tools: true, resources: true, prompts: true },
    authentication: { required: false },
  }
}
