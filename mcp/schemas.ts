/** zod pieces shared by the tools. */
import * as z from 'zod'
import { isDateString } from '../src/data/dates.ts'

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isDateString, 'Not a valid calendar date')
  .describe('A date, YYYY-MM-DD, in Vancouver time')

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, 24-hour')
  .describe('A time of day, HH:mm, 24-hour Vancouver time')

export const id = z.number().int().positive()

export const idList = z.array(id).max(50)

export const dayOfWeek = z.number().int().min(0).max(6)

export const session = z.object({
  start: z.string().describe('YYYY-MM-DDTHH:mm, Vancouver local time'),
  end: z.string().describe('YYYY-MM-DDTHH:mm, Vancouver local time'),
})

export const centreRef = z.object({ id: z.number(), name: z.string() })

export const calendarRef = z.object({ id: z.number(), name: z.string(), group: z.string() })

export const availability = z
  .enum(['open', 'full', 'closed', 'cancelled'])
  .describe('Registration status as of the last scrape; open includes unlimited openings')
