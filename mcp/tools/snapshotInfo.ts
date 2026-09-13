import * as z from 'zod'
import { dateString } from '../schemas.ts'
import { defineTool } from './types.ts'

export const snapshotInfo = defineTool({
  name: 'snapshot_info',
  title: 'About the data',
  description:
    'When the data was scraped from ActiveNet, the date range it covers, counts of calendars, centres, activities and sessions, the weeks that have sessions, and where the JSON data API, llms.txt and prerendered pages live.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    generatedAt: z.string(),
    period: z.object({ start: dateString, end: dateString }),
    today: dateString.describe('Today in Vancouver, as the server sees it'),
    counts: z.object({
      calendars: z.number(),
      centers: z.number(),
      activities: z.number(),
      occurrences: z.number(),
    }),
    weeks: z.array(dateString).describe('Mondays of weeks with sessions'),
    links: z.object({
      site: z.string(),
      llms: z.string(),
      dataApi: z.string(),
      activities: z.string(),
      centres: z.string(),
      source: z.string(),
    }),
    notice: z.string(),
  }),
  async handler(_args, ctx) {
    const meta = await ctx.shards.meta()
    const structuredContent = {
      generatedAt: meta.generatedAt,
      period: meta.period,
      today: ctx.today,
      counts: {
        calendars: meta.counts.calendars,
        centers: meta.counts.centers,
        activities: meta.counts.activities,
        occurrences: meta.counts.occurrences,
      },
      weeks: meta.weeks,
      links: {
        site: `${ctx.site}/`,
        llms: `${ctx.site}/llms.txt`,
        dataApi: `${ctx.site}/data/meta.json`,
        activities: `${ctx.site}/activities/`,
        centres: `${ctx.site}/centres/`,
        source: 'https://anc.ca.apm.activecommunities.com/vancouver/calendars',
      },
      notice:
        'Unofficial mirror of City of Vancouver recreation data published through ActiveNet. Confirm details and register on ActiveNet.',
    }
    const text = `Snapshot scraped ${meta.generatedAt}, covering ${meta.period.start} to ${meta.period.end} (today in Vancouver is ${ctx.today}): ${meta.counts.activities} activities, ${meta.counts.occurrences} sessions, ${meta.counts.centers} centres, ${meta.counts.calendars} calendars. Weeks with sessions start ${meta.weeks.join(', ')}. Data API: ${ctx.site}/data/meta.json · llms.txt: ${ctx.site}/llms.txt · Pages: ${ctx.site}/activities/ and ${ctx.site}/centres/. ${structuredContent.notice}`
    return { structuredContent, text }
  },
})
