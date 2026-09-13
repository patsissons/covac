import * as z from 'zod'
import { defineTool } from './types.ts'

export const listCalendars = defineTool({
  name: 'list_calendars',
  title: 'List calendars',
  description:
    'The ActiveNet calendars the activities come from, each with its group (Drop-in, Fitness, Sports, Art & Culture). Use ids as calendarIds, or a group name, in find_activities and get_schedule.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    groups: z.array(z.string()),
    calendars: z.array(z.object({ id: z.number(), name: z.string(), group: z.string() })),
  }),
  async handler(_args, ctx) {
    const calendars = [...(await ctx.shards.calendars())].sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
    )
    const groups = [...new Set(calendars.map((c) => c.group))]
    const text = groups
      .map(
        (g) =>
          `## ${g}\n${calendars
            .filter((c) => c.group === g)
            .map((c) => `- ${c.name} (id ${c.id})`)
            .join('\n')}`,
      )
      .join('\n\n')
    return { structuredContent: { groups, calendars }, text }
  },
})
