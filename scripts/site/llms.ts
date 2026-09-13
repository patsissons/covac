/**
 * llms.txt (an index for language models), llms-full.txt (every activity on one line each) and
 * one markdown file per centre with full activity write-ups. Generated at build so the counts,
 * period and links are always current.
 */
import type {
  ActivityDetail,
  CatalogActivity,
  CentreSummary,
  SiteMeta,
} from '../../src/data/catalog.ts'
import type { DateString } from '../../src/data/dates.ts'
import { activityPageUrl, centrePageUrl, SITE_URL } from '../../src/data/links.ts'
import { activityLine, activityMarkdown } from '../../src/data/markdown.ts'
import type { Calendar } from '../../src/types/snapshot.ts'

export const centreMarkdownPath = (id: number) => `/llms/centres/${id}.md`

export interface LlmsContext {
  meta: SiteMeta
  centres: CentreSummary[]
  calendars: Calendar[]
  site?: string
}

function summary(meta: SiteMeta): string {
  return `covac (City of Vancouver Active Communities) is an unofficial, read-only mirror of the City of Vancouver's recreation calendar: ${meta.counts.activities} drop-in activities and registered programs with ${meta.counts.occurrences} scheduled sessions at ${meta.counts.centers} community centres, pools and rinks, covering ${meta.period.start} to ${meta.period.end}. The data is scraped nightly from ActiveNet (last scrape ${meta.generatedAt}); times are Vancouver local time. Registration happens on ActiveNet, never here.`
}

function howToQuery(site: string): string {
  return `## How to query

- MCP server (Streamable HTTP, no auth): ${site}/mcp — tools \`search\`, \`fetch\`, \`find_activities\`, \`get_activity\`, \`get_schedule\`, \`list_centres\`, \`list_calendars\`, \`snapshot_info\`. Server card: ${site}/.well-known/mcp/server-card.json
- [Snapshot metadata](${site}/data/meta.json): scrape time, period, counts, weeks with sessions
- [Calendars](${site}/data/calendars.json): calendar ids, names and groups
- [Centres](${site}/data/centres.json): centres with address, phone, coordinates and activity counts
- [Activity catalog](${site}/data/catalog.json): every activity without its description (about 2 MB)
- Sessions per week: ${site}/data/weeks/{monday}.json with rows \`{a: activityId, s: start, e: end}\`
- One activity in full: ${site}/data/activities/{id}.json
- Human pages: ${site}/activities/{id}/ and ${site}/centres/{id}/ (also listed in ${site}/sitemap.xml)
- Calendar deep links: ${site}/?week=YYYY-MM-DD&centers=ID&cal=ID&q=text&from=HH:mm&days=1,2&pmax=10`
}

function calendarLines(calendars: Calendar[]): string[] {
  return [...calendars]
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    .map((c) => `- ${c.name} (${c.group}, id ${c.id})`)
}

export function llmsTxt(ctx: LlmsContext): string {
  const site = ctx.site ?? SITE_URL
  const centres = [...ctx.centres]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (c) =>
        `- [${c.name}](${site}${centreMarkdownPath(c.id)}): ${c.activities} activities${c.address ? `, ${c.address}` : ''}${c.phone ? `, ${c.phone}` : ''}`,
    )
  return [
    '# covac',
    '',
    `> ${summary(ctx.meta)}`,
    '',
    `covac shows one week of every City of Vancouver recreation centre at once at ${site}/, with filters for calendar, centre, day, time and price. Everything below is generated from the same snapshot the app uses. Activity data belongs to the Vancouver Board of Parks and Recreation and is published through ActiveNet; confirm details there before attending.`,
    '',
    howToQuery(site),
    '',
    '## Centres',
    '',
    `Each file lists every activity at the centre in full (description, prices, ages, sessions, links).`,
    '',
    ...centres,
    '',
    '## Calendars',
    '',
    ...calendarLines(ctx.calendars),
    '',
    '## Optional',
    '',
    `- [All activities, one line each](${site}/llms-full.txt): title, centre, calendar, price, ages, next session`,
    `- [Sitemap](${site}/sitemap.xml)`,
    `- [ActiveNet calendars](https://anc.ca.apm.activecommunities.com/vancouver/calendars): the source of the data and where to register`,
    `- [Source code](https://github.com/patsissons/covac)`,
    '',
  ].join('\n')
}

export function llmsFullTxt(
  ctx: LlmsContext,
  activitiesByCentre: Map<number, CatalogActivity[]>,
): string {
  const site = ctx.site ?? SITE_URL
  const calendarById = new Map(ctx.calendars.map((c) => [c.id, c]))
  const sections = [...ctx.centres]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((centre) => {
      const list = [...(activitiesByCentre.get(centre.id) ?? [])].sort((a, b) =>
        a.title.localeCompare(b.title),
      )
      if (!list.length) return []
      return [
        `### ${centre.name}`,
        '',
        `${centre.address ?? ''}${centre.phone ? ` · ${centre.phone}` : ''} · [page](${centrePageUrl(centre.id, site)}) · [full details](${site}${centreMarkdownPath(centre.id)})`,
        '',
        ...list.map((a) => activityLine(a, undefined, calendarById.get(a.calendarId), site)),
        '',
      ]
    })
  return [
    '# covac: every City of Vancouver recreation activity',
    '',
    `> ${summary(ctx.meta)}`,
    '',
    howToQuery(site),
    '',
    '## Calendars',
    '',
    ...calendarLines(ctx.calendars),
    '',
    '## Activities by centre',
    '',
    'One line per activity: title (linked to its page), calendar, price, ages, number of sessions and the next one, instructor.',
    '',
    ...sections,
  ].join('\n')
}

/** Full write-ups of every activity at one centre. */
export function centreMarkdown(
  centre: CentreSummary,
  details: ActivityDetail[],
  today: DateString,
  site = SITE_URL,
): string {
  const groups = new Map<string, ActivityDetail[]>()
  for (const detail of details) {
    const list = groups.get(detail.calendar.group)
    if (list) list.push(detail)
    else groups.set(detail.calendar.group, [detail])
  }
  const sections = [...groups.entries()]
    .sort(([a], [b]) => (a === 'Drop-in' ? -1 : b === 'Drop-in' ? 1 : a.localeCompare(b)))
    .flatMap(([group, list]) => [
      `## ${group}`,
      '',
      ...list
        .sort((a, b) => a.title.localeCompare(b.title))
        // Demote the activity's own headings under the group heading.
        .map((detail) => activityMarkdown(detail, today).replace(/^(#+)/gm, '##$1')),
      '',
    ])
  return [
    `# ${centre.name}`,
    '',
    [
      centre.address,
      centre.phone,
      centre.lat !== undefined && centre.lng !== undefined
        ? `https://www.openstreetmap.org/?mlat=${centre.lat}&mlon=${centre.lng}#map=17/${centre.lat}/${centre.lng}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    `${details.length} activities. Page: ${centrePageUrl(centre.id, site)} · Calendar: ${site}/?centers=${centre.id} · Activity pages: ${details.length ? activityPageUrl(details[0]!.id, site).replace(/\d+\/$/, '{id}/') : ''}`,
    '',
    ...sections,
  ].join('\n')
}
