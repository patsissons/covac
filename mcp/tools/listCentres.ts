import * as z from 'zod'
import { defineTool } from './types.ts'

export const listCentres = defineTool({
  name: 'list_centres',
  title: 'List centres',
  description:
    'Every City of Vancouver community centre, pool and rink in the snapshot with id, address, phone, coordinates, activity count and covac.fyi page. Use the ids as centerIds in find_activities and get_schedule.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    centres: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        address: z.string().optional(),
        phone: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        activities: z.number(),
        url: z.string(),
      }),
    ),
  }),
  async handler(_args, ctx) {
    const shard = await ctx.shards.centres()
    const centres = [...shard.centres]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ ...c, url: `${ctx.site}/centres/${c.id}/` }))
    const text = centres
      .map(
        (c) =>
          `- ${c.name} (id ${c.id}) · ${c.address ?? 'address unknown'}${c.phone ? ` · ${c.phone}` : ''} · ${c.activities} activities · ${c.url}`,
      )
      .join('\n')
    return { structuredContent: { centres }, text }
  },
})
