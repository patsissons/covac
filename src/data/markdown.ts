/** Markdown renderings of activities for language models: MCP tool text, llms files, pages. */
import type { Calendar, Center, Occurrence } from '@/types/snapshot'
import type { ActivityDetail, CatalogActivity } from './catalog'
import { dateOf, formatDay, formatTime, timeOf, type DateString } from './dates'
import { activityPageUrl } from './links'

export function priceLabel(activity: { priceText: string; free: boolean; price?: number }): string {
  if (activity.free || activity.price === 0) return 'Free'
  if (activity.priceText) return activity.priceText
  return activity.price !== undefined ? `$${activity.price.toFixed(2)}` : 'Price not listed'
}

/** `Mon Sep 14 7:00 am` for a session start. */
export function formatSessionStart(iso: string): string {
  return `${formatDay(dateOf(iso))} ${formatTime(timeOf(iso))}`
}

/** Sessions grouped by date: `- Mon Sep 14: 7:00 am – 8:00 am, 2:00 pm – 4:00 pm`. */
export function sessionLines(sessions: Occurrence[], max = Infinity): string[] {
  const byDay = new Map<DateString, string[]>()
  for (const session of sessions) {
    const day = dateOf(session.s)
    const range = `${formatTime(timeOf(session.s))} – ${formatTime(timeOf(session.e))}`
    const list = byDay.get(day)
    if (list) list.push(range)
    else byDay.set(day, [range])
  }
  const lines = [...byDay.entries()].map(
    ([day, ranges]) => `- ${formatDay(day)}: ${ranges.join(', ')}`,
  )
  if (lines.length > max) {
    const hidden = lines.length - max
    return [...lines.slice(0, max), `- … ${hidden} more ${hidden === 1 ? 'day' : 'days'}`]
  }
  return lines
}

/** One-line summary with a link to the covac page. */
export function activityLine(
  activity: CatalogActivity,
  centre?: Center,
  calendar?: Calendar,
  site?: string,
): string {
  const parts = [
    `[${activity.title}](${activityPageUrl(activity.id, site)})`,
    centre?.name,
    calendar?.name,
    priceLabel(activity),
    activity.ageText,
    activity.n
      ? `${activity.n} ${activity.n === 1 ? 'session' : 'sessions'}${activity.first ? `, next ${formatSessionStart(activity.first)}` : ''}`
      : undefined,
    activity.instructors?.length ? `with ${activity.instructors.join(', ')}` : undefined,
  ].filter((part): part is string => !!part)
  return `- ${parts.join(' · ')}`
}

/** Full activity write-up: facts, description, sessions and links. */
export function activityMarkdown(detail: ActivityDetail, today?: DateString): string {
  const upcoming = today ? detail.sessions.filter((s) => dateOf(s.s) >= today) : detail.sessions
  const facts: string[] = [
    `- Centre: ${detail.center.name}${detail.center.address ? `, ${detail.center.address}` : ''}${detail.center.phone ? ` (${detail.center.phone})` : ''}`,
    `- Calendar: ${detail.calendar.name} (${detail.calendar.group})`,
    `- Price: ${priceLabel({ priceText: detail.priceText, free: detail.free })}`,
  ]
  if (detail.ageText) facts.push(`- Ages: ${detail.ageText}`)
  if (detail.openings) facts.push(`- Openings: ${detail.openings}`)
  if (detail.instructors.length) facts.push(`- Instructors: ${detail.instructors.join(', ')}`)
  if (detail.facilities.length) facts.push(`- Where: ${detail.facilities.join(', ')}`)
  if (detail.firstDate && detail.lastDate)
    facts.push(`- Runs: ${detail.firstDate} to ${detail.lastDate}`)

  const sections: string[] = [`# ${detail.title}`, facts.join('\n')]
  if (detail.descriptionText) sections.push(detail.descriptionText)
  if (detail.prices?.length) {
    sections.push(
      ['## Fees', ...detail.prices.map((line) => `- ${line.price}: ${line.description}`)].join(
        '\n',
      ),
    )
  }
  const heading = today ? `## Upcoming sessions (Vancouver time)` : `## Sessions (Vancouver time)`
  const lines = sessionLines(upcoming)
  sections.push(
    [
      heading,
      ...(lines.length ? lines : ['- No sessions on or after today in the current snapshot']),
    ].join('\n'),
  )
  sections.push(
    [
      '## Links',
      `- Register or see details on ActiveNet: ${detail.url}`,
      `- covac page: ${detail.pageUrl}`,
      `- Open in the covac calendar: ${detail.link}`,
    ].join('\n'),
  )
  return sections.join('\n\n')
}
