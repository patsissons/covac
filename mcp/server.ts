/**
 * Build the MCP server for one request. `createMcpHandler` calls this factory per request (the
 * 2026-07-28 protocol is stateless), so it must be cheap: registrations are a few closures, and
 * all data comes from the isolate-wide shard cache.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { activityMarkdown } from '../src/data/markdown.ts'
import type { Shards } from './data.ts'
import { TOOLS } from './tools/index.ts'
import type { ToolContext } from './tools/types.ts'

export const SERVER_NAME = 'covac'
export const SERVER_TITLE = 'covac · City of Vancouver recreation activities'
export const SERVER_DESCRIPTION =
  'Search and browse City of Vancouver recreation activities (drop-in swims, skates and gyms, fitness classes, sports, arts and other programs at community centres, pools and rinks) from a nightly snapshot of the ActiveNet calendar.'

/** Cache hints for list results: the data changes at most once a day, on deploy. */
const HOUR = 3_600_000
const CACHE_HINT = { ttlMs: HOUR, cacheScope: 'public' as const }

export function instructions(period: { start: string; end: string }, today: string): string {
  return [
    `covac mirrors the City of Vancouver recreation calendar (ActiveNet). The snapshot covers ${period.start} to ${period.end}; today in Vancouver is ${today}. All times are Vancouver local time.`,
    'Use find_activities for "what can I do when/where" questions (filters: text, group, centres, dates, days, times, price, age), get_schedule for everything on one date, search + fetch or get_activity for details of one activity, list_centres and list_calendars for the ids the filters take.',
    'Always give the user the covac.fyi page URL or the ActiveNet URL from the result so they can register and confirm details; this data is an unofficial nightly mirror, and openings change during the day.',
  ].join('\n')
}

/** Everything registered on a fresh server; exported so the server card can mirror it. */
export const RESOURCES = [
  {
    uri: 'covac://snapshot',
    name: 'snapshot',
    title: 'Snapshot metadata',
    mimeType: 'application/json',
  },
  {
    uri: 'covac://centres',
    name: 'centres',
    title: 'Centres and facilities',
    mimeType: 'application/json',
  },
  { uri: 'covac://calendars', name: 'calendars', title: 'Calendars', mimeType: 'application/json' },
] as const

export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'covac://activities/{id}',
    name: 'activity',
    title: 'One activity as markdown',
    mimeType: 'text/markdown',
  },
] as const

export const PROMPTS = [
  {
    name: 'plan_activities',
    title: 'Plan recreation activities',
    description:
      'Find City of Vancouver recreation activities for a time, interests and neighbourhood, and present them with links.',
  },
] as const

export async function createServer(ctx: ToolContext): Promise<McpServer> {
  const meta = await ctx.shards.meta()
  const server = new McpServer(
    {
      name: SERVER_NAME,
      title: SERVER_TITLE,
      version: meta.version,
      description: SERVER_DESCRIPTION,
      websiteUrl: `${ctx.site}/`,
    },
    {
      instructions: instructions(meta.period, ctx.today),
      cacheHints: {
        'server/discover': CACHE_HINT,
        'tools/list': CACHE_HINT,
        'prompts/list': CACHE_HINT,
        'resources/list': CACHE_HINT,
        'resources/templates/list': CACHE_HINT,
        'resources/read': CACHE_HINT,
      },
    },
  )

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: {
          title: tool.title,
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        const result = await tool.handler(args, ctx)
        return {
          content: [{ type: 'text' as const, text: result.text }],
          ...(result.structuredContent !== undefined && {
            structuredContent: result.structuredContent,
          }),
          ...(result.isError && { isError: true }),
        }
      },
    )
  }

  const json = (uri: string, mimeType: string, value: unknown) => ({
    contents: [{ uri, mimeType, text: JSON.stringify(value) }],
  })
  const loaders: Record<(typeof RESOURCES)[number]['name'], (s: Shards) => Promise<unknown>> = {
    snapshot: (s) => s.meta(),
    centres: (s) => s.centres(),
    calendars: (s) => s.calendars(),
  }
  for (const resource of RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, mimeType: resource.mimeType, cacheHint: CACHE_HINT },
      async (uri) => json(uri.href, resource.mimeType, await loaders[resource.name](ctx.shards)),
    )
  }
  const [activityTemplate] = RESOURCE_TEMPLATES
  server.registerResource(
    activityTemplate.name,
    new ResourceTemplate(activityTemplate.uriTemplate, { list: undefined }),
    { title: activityTemplate.title, mimeType: activityTemplate.mimeType, cacheHint: CACHE_HINT },
    async (uri, variables) => {
      const id = Number(variables.id)
      const detail = Number.isInteger(id) ? await ctx.shards.activity(id) : undefined
      if (!detail)
        throw new Error(`No activity with id ${String(variables.id)} in the current snapshot`)
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/markdown', text: activityMarkdown(detail, ctx.today) },
        ],
      }
    },
  )

  const [plan] = PROMPTS
  server.registerPrompt(
    plan.name,
    {
      title: plan.title,
      description: plan.description,
      argsSchema: z.object({
        when: z
          .string()
          .describe('When, e.g. "this Saturday morning" or "weekday evenings next week"'),
        interests: z.string().optional().describe('What they enjoy, e.g. "swimming and yoga"'),
        near: z.string().optional().describe('Neighbourhood or centre, e.g. "Kitsilano"'),
      }),
    },
    ({ when, interests, near }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Help me find City of Vancouver recreation activities ${when}${interests ? ` for ${interests}` : ''}${near ? ` near ${near}` : ''}.`,
              'Call snapshot_info once to learn the date range, use list_centres to map the neighbourhood to centre ids, then find_activities with the matching filters (dates, days, times, group, price or age if I mentioned them).',
              'Present the best options grouped by day with times, centre, price and the covac.fyi link for each, mention how to register on ActiveNet, and note that openings can change during the day.',
            ].join(' '),
          },
        },
      ],
    }),
  )

  return server
}
