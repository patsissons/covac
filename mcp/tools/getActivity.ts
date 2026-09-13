import * as z from 'zod'
import { activityMarkdown, priceLabel } from '../../src/data/markdown.ts'
import { toOffsetIso } from '../../src/data/tz.ts'
import { availability, calendarRef, id, session } from '../schemas.ts'
import { defineTool, failure } from './types.ts'

export const getActivity = defineTool({
  name: 'get_activity',
  title: 'Get an activity',
  description:
    'Everything the snapshot knows about one activity by numeric id: description, fee table, age range, openings, instructors, facilities, centre with address and phone, every scheduled session (Vancouver local time, with UTC offsets), the covac.fyi page and the ActiveNet registration URL.',
  inputSchema: z.object({
    id: id.describe('Activity id from search, find_activities or get_schedule'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().describe('Plain text'),
    centre: z.object({
      id: z.number(),
      name: z.string(),
      address: z.string().optional(),
      phone: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }),
    calendar: calendarRef,
    facilities: z.array(z.string()),
    price: z.string(),
    free: z.boolean(),
    fees: z.array(z.object({ price: z.string(), description: z.string() })).optional(),
    ages: z.string().optional(),
    ageMin: z.number().optional(),
    ageMax: z.number().optional(),
    openings: z.string().optional(),
    availability: availability.optional(),
    spaces: z
      .number()
      .optional()
      .describe('Remaining spaces when the openings label carries a count'),
    instructors: z.array(z.string()),
    runs: z.object({ first: z.string(), last: z.string() }).optional(),
    sessions: z.array(session.extend({ startIso: z.string(), endIso: z.string() })),
    url: z.string().describe('covac.fyi page'),
    calendarLink: z.string().describe('covac.fyi calendar showing this activity'),
    activenetUrl: z.string().describe('Details and registration on ActiveNet'),
  }),
  async handler({ id }, ctx) {
    const detail = await ctx.shards.activity(id)
    if (!detail) {
      const meta = await ctx.shards.meta()
      return failure(
        `No activity with id ${id} in the current snapshot (${meta.period.start} to ${meta.period.end}). Use search or find_activities to locate one.`,
      )
    }
    const structuredContent = {
      id: detail.id,
      title: detail.title,
      description: detail.descriptionText,
      centre: {
        id: detail.center.id,
        name: detail.center.name,
        address: detail.center.address,
        phone: detail.center.phone,
        lat: detail.center.lat,
        lng: detail.center.lng,
      },
      calendar: detail.calendar,
      facilities: detail.facilities,
      price: priceLabel(detail),
      free: detail.free,
      fees: detail.prices,
      ages: detail.ageText,
      ageMin: detail.ageMin,
      ageMax: detail.ageMax,
      openings: detail.openings,
      availability: detail.availability,
      spaces: detail.spaces,
      instructors: detail.instructors,
      runs:
        detail.firstDate && detail.lastDate
          ? { first: detail.firstDate, last: detail.lastDate }
          : undefined,
      sessions: detail.sessions.map((s) => ({
        start: s.s,
        end: s.e,
        startIso: toOffsetIso(s.s),
        endIso: toOffsetIso(s.e),
      })),
      url: `${ctx.site}/activities/${detail.id}/`,
      calendarLink: detail.link,
      activenetUrl: detail.url,
    }
    return { structuredContent, text: activityMarkdown(detail, ctx.today) }
  },
})
