import * as z from 'zod'
import { weeksCovering } from '../../src/data/catalog.ts'
import { startOfWeek } from '../../src/data/dates.ts'
import { formatSessionStart } from '../../src/data/markdown.ts'
import { filterOccurrences, groupSessions } from '../../src/data/search.ts'
import {
  availability,
  calendarRef,
  centreRef,
  dateString,
  dayOfWeek,
  hhmm,
  idList,
  session,
} from '../schemas.ts'
import { calendarIdsForGroup, calendarLink, resolveRange, summarise } from './shared.ts'
import { defineTool, failure } from './types.ts'

const result = z.object({
  id: z.number(),
  title: z.string(),
  centre: centreRef,
  calendar: calendarRef,
  price: z.string(),
  priceAmount: z.number().optional(),
  free: z.boolean(),
  ages: z.string().optional(),
  openings: z.string().optional(),
  availability: availability.optional(),
  spaces: z
    .number()
    .optional()
    .describe('Remaining spaces when the openings label carries a count'),
  instructors: z.array(z.string()).optional(),
  url: z.string(),
  sessions: z.array(session).describe('Up to 10 matching sessions in the range'),
  sessionCount: z.number().describe('All matching sessions in the range'),
})

export const findActivities = defineTool({
  name: 'find_activities',
  title: 'Find activities',
  description:
    'Find sessions of City of Vancouver recreation activities that match filters, for questions like "what can I do near Kitsilano on Saturday morning", "free drop-in swims this week" or "yoga for a 70-year-old under $10". Filters: free text, calendar group (Drop-in, Fitness, Sports, Art & Culture) or calendar ids, centre ids (see list_centres), a date range (defaults to today through six days ahead; at most eight weeks and within the snapshot period), days of week, a start-time window, a maximum price in CAD, free only, available only (drops full, closed and cancelled activities), and participant age. Returns activities with their matching sessions in Vancouver local time, page URLs, and a covac.fyi calendar link showing the same filters.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Words to match in title, instructor, centre, calendar or description'),
    group: z
      .string()
      .optional()
      .describe('Calendar group: Drop-in, Fitness, Sports or Art & Culture'),
    calendarIds: idList.optional().describe('Calendar ids from list_calendars'),
    centerIds: idList.optional().describe('Centre ids from list_centres'),
    dateFrom: dateString.optional().describe('First date to include (default today)'),
    dateTo: dateString.optional().describe('Last date to include (default dateFrom + 6 days)'),
    days: z
      .array(dayOfWeek)
      .optional()
      .describe('Days of week to include, 0 = Sunday … 6 = Saturday'),
    timeFrom: hhmm.optional().describe('Earliest session start'),
    timeTo: hhmm.optional().describe('Latest session start'),
    priceMax: z
      .number()
      .min(0)
      .optional()
      .describe('Highest price in CAD; activities with no listed price are excluded'),
    freeOnly: z.boolean().optional(),
    availableOnly: z
      .boolean()
      .optional()
      .describe('Exclude activities that are full, closed or cancelled as of the last scrape'),
    age: z.number().int().min(0).max(120).optional().describe('Participant age in years'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum activities to return (default 25)'),
  }),
  outputSchema: z.object({
    range: z.object({ from: dateString, to: dateString }),
    note: z.string().optional(),
    total: z.number().describe('Matching activities before the limit'),
    truncated: z.boolean(),
    link: z.string().describe('covac.fyi calendar with these filters applied'),
    results: z.array(result),
  }),
  async handler(args, ctx) {
    const [meta, calendars, search] = await Promise.all([
      ctx.shards.meta(),
      ctx.shards.calendars(),
      ctx.shards.searchContext(),
    ])
    let calendarIds = args.calendarIds
    if (args.group) {
      const ids = calendarIdsForGroup(calendars, args.group)
      if (!ids) {
        const groups = [...new Set(calendars.map((c) => c.group))].join(', ')
        return failure(`Unknown calendar group "${args.group}". Groups are: ${groups}.`)
      }
      calendarIds = calendarIds?.length ? calendarIds.filter((id) => ids.includes(id)) : ids
    }
    const range = resolveRange(args.dateFrom, args.dateTo, ctx.today, meta.period)
    const weeks = weeksCovering(range.from, range.to).filter((w) => meta.weeks.includes(w))
    const shards = await Promise.all(weeks.map((w) => ctx.shards.week(w)))
    const occurrences = filterOccurrences(
      shards.flatMap((s) => s.occurrences),
      search,
      {
        q: args.query,
        calendarIds,
        centerIds: args.centerIds,
        dateFrom: range.from,
        dateTo: range.to,
        days: args.days,
        timeFrom: args.timeFrom,
        timeTo: args.timeTo,
        priceMax: args.priceMax,
        freeOnly: args.freeOnly,
        availableOnly: args.availableOnly,
        age: args.age,
      },
    )
    const groups = groupSessions(occurrences, search.activityById)
    const limit = args.limit ?? 25
    const results = groups.slice(0, limit).map(({ activity, sessions }) => ({
      ...summarise(activity, search, ctx.site),
      sessions: sessions.slice(0, 10).map((s) => ({ start: s.s, end: s.e })),
      sessionCount: sessions.length,
    }))
    const link = calendarLink(ctx.site, startOfWeek(range.from), {
      centerIds: args.centerIds,
      calendarIds,
      q: args.query,
      from: args.timeFrom,
      to: args.timeTo,
      days: args.days,
      priceMax: args.priceMax,
      openOnly: args.availableOnly,
    })
    const structuredContent = {
      range: { from: range.from, to: range.to },
      note: range.note,
      total: groups.length,
      truncated: groups.length > limit,
      link,
      results,
    }
    const lines = results.map(
      (r) =>
        `- ${r.title} — ${r.centre.name} (${r.calendar.name}) · ${r.price}${r.ages ? ` · ${r.ages}` : ''} · ${r.sessionCount} session${r.sessionCount === 1 ? '' : 's'}: ${r.sessions
          .slice(0, 3)
          .map((s) => formatSessionStart(s.start))
          .join(', ')}${r.sessionCount > 3 ? ', …' : ''} · ${r.url}`,
    )
    const text = [
      `${groups.length} matching activit${groups.length === 1 ? 'y' : 'ies'} between ${range.from} and ${range.to}${structuredContent.truncated ? ` (showing ${limit})` : ''}.`,
      range.note ?? '',
      ...lines,
      '',
      `Calendar view: ${link}`,
    ]
      .filter((line, i) => line !== '' || i > 0)
      .join('\n')
    return { structuredContent, text }
  },
})
