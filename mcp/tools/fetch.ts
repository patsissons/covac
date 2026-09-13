/** ChatGPT connector contract: `fetch` returns one document `{ id, title, text, url, metadata }`. */
import * as z from 'zod'
import { nextSession } from '../../src/data/catalog.ts'
import { activityMarkdown, priceLabel } from '../../src/data/markdown.ts'
import { defineTool, failure } from './types.ts'

export const fetchTool = defineTool({
  name: 'fetch',
  title: 'Fetch an activity',
  description:
    'Fetch one activity by id (from `search`) as a markdown document: description, prices, age range, openings, instructors, every scheduled session in the snapshot window in Vancouver local time, the covac.fyi page URL and the ActiveNet registration URL.',
  inputSchema: z.object({
    id: z.string().describe('Activity id returned by search'),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    url: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  async handler({ id }, ctx) {
    const numeric = Number(id)
    const detail =
      Number.isInteger(numeric) && numeric > 0 ? await ctx.shards.activity(numeric) : undefined
    if (!detail) {
      const meta = await ctx.shards.meta()
      return failure(
        `No activity with id ${id} in the current snapshot (${meta.period.start} to ${meta.period.end}). Use search to find one.`,
      )
    }
    const next = nextSession(detail.sessions, ctx.today)
    const structuredContent = {
      id: String(detail.id),
      title: detail.title,
      text: activityMarkdown(detail, ctx.today),
      url: `${ctx.site}/activities/${detail.id}/`,
      metadata: {
        centre: detail.center.name,
        address: detail.center.address,
        calendar: detail.calendar.name,
        group: detail.calendar.group,
        price: priceLabel(detail),
        free: detail.free,
        ages: detail.ageText,
        openings: detail.openings,
        activenetUrl: detail.url,
        sessionCount: detail.sessions.length,
        nextSession: next?.s,
      },
    }
    return { structuredContent, text: JSON.stringify(structuredContent) }
  },
})
