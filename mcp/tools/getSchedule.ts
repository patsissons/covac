import * as z from 'zod'
import { formatDay, formatTime, startOfWeek, timeOf } from '../../src/data/dates.ts'
import { priceLabel } from '../../src/data/markdown.ts'
import { filterOccurrences } from '../../src/data/search.ts'
import { dateString, id, idList } from '../schemas.ts'
import { calendarIdsForGroup } from './shared.ts'
import { defineTool, failure } from './types.ts'

export const getSchedule = defineTool({
  name: 'get_schedule',
  title: 'Get a day’s schedule',
  description:
    'Every session on one date (default today in Vancouver), optionally at one centre and/or in one calendar group, ordered by start time and grouped by centre. Good for "what is on at Hillcrest on Saturday" or "everything happening tonight".',
  inputSchema: z.object({
    date: dateString.optional().describe('Defaults to today'),
    centerId: id.optional().describe('Centre id from list_centres'),
    group: z
      .string()
      .optional()
      .describe('Calendar group: Drop-in, Fitness, Sports or Art & Culture'),
    calendarIds: idList.optional(),
    limit: z.number().int().min(1).max(500).optional().describe('Maximum sessions (default 200)'),
  }),
  outputSchema: z.object({
    date: dateString,
    total: z.number(),
    truncated: z.boolean(),
    link: z.string().describe('covac.fyi calendar for that week'),
    centres: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        sessions: z.array(
          z.object({
            start: z.string(),
            end: z.string(),
            activityId: z.number(),
            title: z.string(),
            calendar: z.string(),
            price: z.string(),
            url: z.string(),
          }),
        ),
      }),
    ),
  }),
  async handler(args, ctx) {
    const [meta, calendars, search] = await Promise.all([
      ctx.shards.meta(),
      ctx.shards.calendars(),
      ctx.shards.searchContext(),
    ])
    const date = args.date ?? ctx.today
    if (date < meta.period.start || date > meta.period.end) {
      return failure(
        `${date} is outside the snapshot, which covers ${meta.period.start} to ${meta.period.end}.`,
      )
    }
    let calendarIds = args.calendarIds
    if (args.group) {
      const ids = calendarIdsForGroup(calendars, args.group)
      if (!ids) return failure(`Unknown calendar group "${args.group}".`)
      calendarIds = calendarIds?.length ? calendarIds.filter((c) => ids.includes(c)) : ids
    }
    const week = await ctx.shards.week(startOfWeek(date))
    const occurrences = filterOccurrences(week.occurrences, search, {
      dateFrom: date,
      dateTo: date,
      centerIds: args.centerId ? [args.centerId] : undefined,
      calendarIds,
    })
    const limit = args.limit ?? 200
    const shown = occurrences.slice(0, limit)
    const byCentre = new Map<number, { id: number; name: string; sessions: Sessions }>()
    for (const o of shown) {
      const activity = search.activityById.get(o.a)
      if (!activity) continue
      const centre = byCentre.get(activity.centerId) ?? {
        id: activity.centerId,
        name: search.centerById.get(activity.centerId)?.name ?? `Centre ${activity.centerId}`,
        sessions: [],
      }
      centre.sessions.push({
        start: o.s,
        end: o.e,
        activityId: activity.id,
        title: activity.title,
        calendar: search.calendarById.get(activity.calendarId)?.name ?? '',
        price: priceLabel(activity),
        url: `${ctx.site}/activities/${activity.id}/`,
      })
      byCentre.set(activity.centerId, centre)
    }
    const centres = [...byCentre.values()].sort((a, b) => a.name.localeCompare(b.name))
    const link = `${ctx.site}/?week=${startOfWeek(date)}${args.centerId ? `&centers=${args.centerId}` : ''}${calendarIds?.length ? `&cal=${calendarIds.join(',')}` : ''}`
    const structuredContent = {
      date,
      total: occurrences.length,
      truncated: occurrences.length > limit,
      link,
      centres,
    }
    const text = [
      `${occurrences.length} session${occurrences.length === 1 ? '' : 's'} on ${formatDay(date)}${structuredContent.truncated ? ` (showing ${limit})` : ''}.`,
      ...centres.map(
        (c) =>
          `## ${c.name}\n${c.sessions
            .map(
              (s) =>
                `- ${formatTime(timeOf(s.start))} – ${formatTime(timeOf(s.end))}: ${s.title} (${s.calendar}, ${s.price}) · id ${s.activityId}`,
            )
            .join('\n')}`,
      ),
      `Calendar view: ${link}`,
    ].join('\n\n')
    return { structuredContent, text }
  },
})

type Sessions = {
  start: string
  end: string
  activityId: number
  title: string
  calendar: string
  price: string
  url: string
}[]
