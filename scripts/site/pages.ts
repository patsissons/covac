/** Prerendered HTML pages: one per activity, one per centre, and two indexes. */
import type { ActivityDetail, CatalogActivity, CentreSummary } from '../../src/data/catalog.ts'
import { dateOf, formatDay, formatTime, timeOf, type DateString } from '../../src/data/dates.ts'
import {
  breadcrumbNode,
  eventNodes,
  jsonLdScript,
  placeNode,
  type JsonLd,
} from '../../src/data/jsonld.ts'
import {
  activityPagePath,
  activityPageUrl,
  centrePagePath,
  centrePageUrl,
} from '../../src/data/links.ts'
import { formatSessionStart, priceLabel } from '../../src/data/markdown.ts'
import { blurb } from '../../src/data/text.ts'
import { toOffsetIso } from '../../src/data/tz.ts'
import type { Calendar } from '../../src/types/snapshot.ts'
import { breadcrumbs, esc, groupChip, layout } from './html.ts'

export interface PageContext {
  site: string
  generatedAt: string
  today: DateString
  calendarById: Map<number, Calendar>
}

/** Sessions worth marking up: upcoming ones first, falling back to the most recent. */
export function eventSessions(detail: ActivityDetail, today: DateString, max = 20) {
  const upcoming = detail.sessions.filter((s) => dateOf(s.s) >= today)
  return upcoming.length ? upcoming.slice(0, max) : detail.sessions.slice(-max)
}

function sessionList(detail: ActivityDetail, today: DateString): string {
  const byDay = new Map<DateString, typeof detail.sessions>()
  for (const s of detail.sessions) {
    const day = dateOf(s.s)
    const list = byDay.get(day)
    if (list) list.push(s)
    else byDay.set(day, [s])
  }
  if (!byDay.size) return '<p class="muted">No sessions in the current snapshot.</p>'
  const items = [...byDay.entries()].map(([day, sessions]) => {
    const past = day < today ? ' class="muted"' : ''
    const times = sessions
      .map(
        (s) =>
          `<time datetime="${toOffsetIso(s.s)}">${formatTime(timeOf(s.s))}</time> – <time datetime="${toOffsetIso(s.e)}">${formatTime(timeOf(s.e))}</time>`,
      )
      .join(', ')
    return `<li${past}>${esc(formatDay(day))}: ${times}</li>`
  })
  return `<ul class="sessions">${items.join('')}</ul>`
}

export function activityPage(detail: ActivityDetail, ctx: PageContext): string {
  const { site } = ctx
  const canonical = activityPageUrl(detail.id, site)
  const centreUrl = centrePageUrl(detail.center.id, site)
  const description = blurb(
    detail.descriptionText ||
      `${detail.title} at ${detail.center.name}, a City of Vancouver ${detail.calendar.name} activity.`,
    160,
  )
  const facts = [
    groupChip(detail.calendar.group),
    `<li><a href="${esc(centreUrl)}">${esc(detail.center.name)}</a></li>`,
    `<li>${esc(detail.calendar.name)}</li>`,
    `<li>${esc(priceLabel(detail))}</li>`,
    detail.ageText ? `<li>${esc(detail.ageText)}</li>` : '',
    detail.openings ? `<li>${esc(detail.openings)}</li>` : '',
  ].join('')
  const fees = detail.prices?.length
    ? `<h2>Fees</h2><table><tbody>${detail.prices
        .map((p) => `<tr><th>${esc(p.price)}</th><td>${esc(p.description)}</td></tr>`)
        .join('')}</tbody></table>`
    : ''
  const details = [
    detail.instructors.length ? `<li>Instructors: ${esc(detail.instructors.join(', '))}</li>` : '',
    detail.facilities.length ? `<li>Where: ${esc(detail.facilities.join(', '))}</li>` : '',
    detail.firstDate && detail.lastDate
      ? `<li>Runs ${esc(detail.firstDate)} to ${esc(detail.lastDate)}</li>`
      : '',
  ]
    .filter(Boolean)
    .join('')
  const body = `
${breadcrumbs([
  { name: 'covac', url: `${site}/` },
  { name: 'Centres', url: `${site}/centres/` },
  { name: detail.center.name, url: centreUrl },
  { name: detail.title },
])}
<h1>${esc(detail.title)}</h1>
<ul class="facts">${facts}</ul>
<div class="actions">
<a class="primary" href="${esc(detail.url)}" rel="noopener">Register / details on ActiveNet</a>
<a href="${esc(detail.link)}">Open in the covac calendar</a>
</div>
${detail.description ? `<div class="card">${detail.description}</div>` : ''}
${details ? `<ul class="facts">${details}</ul>` : ''}
${fees}
<h2>Sessions <span class="muted">(Vancouver time)</span></h2>
${sessionList(detail, ctx.today)}
`
  const graph: JsonLd[] = [
    breadcrumbNode([
      { name: 'covac', url: `${site}/` },
      { name: 'Centres', url: `${site}/centres/` },
      { name: detail.center.name, url: centreUrl },
      { name: detail.title, url: canonical },
    ]),
    {
      '@type': 'WebPage',
      '@id': canonical,
      url: canonical,
      name: detail.title,
      description,
      isPartOf: { '@id': `${site}/#website` },
      dateModified: ctx.generatedAt,
    },
    ...eventNodes(detail, eventSessions(detail, ctx.today), site),
  ]
  return layout({
    title: `${detail.title} at ${detail.center.name}`,
    description,
    canonical,
    jsonLd: jsonLdScript(graph),
    body,
    head: `<link rel="alternate" type="application/json" href="${esc(site)}/data/activities/${detail.id}.json">`,
    site,
    generatedAt: ctx.generatedAt,
  })
}

function activityItem(activity: CatalogActivity, ctx: PageContext, showCentre?: string): string {
  const calendar = ctx.calendarById.get(activity.calendarId)
  const meta = [
    showCentre,
    calendar?.name,
    priceLabel(activity),
    activity.ageText,
    activity.first ? `next ${formatSessionStart(activity.first)}` : undefined,
  ]
    .filter(Boolean)
    .map((part) => esc(part))
    .join(' · ')
  return `<li><a href="${esc(ctx.site)}${activityPagePath(activity.id)}">${esc(activity.title)}</a> <span class="muted">${meta}</span></li>`
}

export function centrePage(
  centre: CentreSummary,
  activities: CatalogActivity[],
  ctx: PageContext,
): string {
  const { site } = ctx
  const canonical = centrePageUrl(centre.id, site)
  const groups = new Map<string, CatalogActivity[]>()
  for (const activity of activities) {
    const group = ctx.calendarById.get(activity.calendarId)?.group ?? 'Other'
    const list = groups.get(group)
    if (list) list.push(activity)
    else groups.set(group, [activity])
  }
  const sections = [...groups.entries()]
    .sort(([a], [b]) => (a === 'Drop-in' ? -1 : b === 'Drop-in' ? 1 : a.localeCompare(b)))
    .map(
      ([group, list]) =>
        `<h2>${groupChip(group)} <span class="muted">${list.length}</span></h2><ul class="plain">${list
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((a) => activityItem(a, ctx))
          .join('')}</ul>`,
    )
    .join('')
  const map =
    centre.lat !== undefined && centre.lng !== undefined
      ? `<a href="https://www.openstreetmap.org/?mlat=${centre.lat}&amp;mlon=${centre.lng}#map=17/${centre.lat}/${centre.lng}" rel="noopener">Map</a>`
      : ''
  const description = `${centre.activities} recreation activities at ${centre.name}${centre.address ? `, ${centre.address}` : ''}: drop-in swims, skates, fitness, sports and programs from the City of Vancouver.`
  const body = `
${breadcrumbs([{ name: 'covac', url: `${site}/` }, { name: 'Centres', url: `${site}/centres/` }, { name: centre.name }])}
<h1>${esc(centre.name)}</h1>
<ul class="facts">
${centre.address ? `<li><address>${esc(centre.address)}</address></li>` : ''}
${centre.phone ? `<li><a href="tel:${esc(centre.phone.replace(/[^\d+]/g, ''))}">${esc(centre.phone)}</a></li>` : ''}
<li>${centre.activities} activities</li>
</ul>
<div class="actions">
<a class="primary" href="${esc(site)}/?centers=${centre.id}">Open in the covac calendar</a>
${map ? `<span>${map}</span>` : ''}
</div>
${sections || '<p class="muted">No activities in the current snapshot.</p>'}
`
  const graph: JsonLd[] = [
    breadcrumbNode([
      { name: 'covac', url: `${site}/` },
      { name: 'Centres', url: `${site}/centres/` },
      { name: centre.name, url: canonical },
    ]),
    { ...placeNode(centre, site), description },
    {
      '@type': 'ItemList',
      name: `Activities at ${centre.name}`,
      numberOfItems: activities.length,
      itemListElement: activities.slice(0, 200).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title,
        url: activityPageUrl(a.id, site),
      })),
    },
  ]
  return layout({
    title: centre.name,
    description: blurb(description, 160),
    canonical,
    jsonLd: jsonLdScript(graph),
    body,
    site,
    generatedAt: ctx.generatedAt,
  })
}

export function centresIndexPage(centres: CentreSummary[], ctx: PageContext): string {
  const { site } = ctx
  const canonical = `${site}/centres/`
  const items = [...centres]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (c) =>
        `<li><a href="${esc(site)}${centrePagePath(c.id)}">${esc(c.name)}</a> <span class="muted">${esc(c.address ?? '')}${c.address ? ' · ' : ''}${c.activities} activities</span></li>`,
    )
    .join('')
  const description = `All ${centres.length} City of Vancouver recreation centres, pools and rinks with their current activities.`
  return layout({
    title: 'Recreation centres in Vancouver',
    description,
    canonical,
    jsonLd: jsonLdScript([
      breadcrumbNode([
        { name: 'covac', url: `${site}/` },
        { name: 'Centres', url: canonical },
      ]),
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: 'Recreation centres in Vancouver',
        description,
        isPartOf: { '@id': `${site}/#website` },
      },
    ]),
    body: `${breadcrumbs([{ name: 'covac', url: `${site}/` }, { name: 'Centres' }])}<h1>Recreation centres</h1><p class="muted">${esc(description)}</p><ul class="plain">${items}</ul>`,
    site,
    generatedAt: ctx.generatedAt,
  })
}

export function activitiesIndexPage(
  centres: CentreSummary[],
  activitiesByCentre: Map<number, CatalogActivity[]>,
  ctx: PageContext,
): string {
  const { site } = ctx
  const canonical = `${site}/activities/`
  const total = [...activitiesByCentre.values()].reduce((n, list) => n + list.length, 0)
  const sections = [...centres]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const list = (activitiesByCentre.get(c.id) ?? []).sort((a, b) =>
        a.title.localeCompare(b.title),
      )
      if (!list.length) return ''
      return `<h2 id="centre-${c.id}"><a href="${esc(site)}${centrePagePath(c.id)}">${esc(c.name)}</a> <span class="muted">${list.length}</span></h2><ul class="plain">${list
        .map((a) => activityItem(a, ctx))
        .join('')}</ul>`
    })
    .join('')
  const description = `All ${total} City of Vancouver recreation activities in the current snapshot, grouped by centre.`
  return layout({
    title: 'Recreation activities in Vancouver',
    description,
    canonical,
    jsonLd: jsonLdScript([
      breadcrumbNode([
        { name: 'covac', url: `${site}/` },
        { name: 'Activities', url: canonical },
      ]),
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: 'Recreation activities in Vancouver',
        description,
        isPartOf: { '@id': `${site}/#website` },
      },
    ]),
    body: `${breadcrumbs([{ name: 'covac', url: `${site}/` }, { name: 'Activities' }])}<h1>Recreation activities</h1><p class="muted">${esc(description)} Data as of ${esc(ctx.generatedAt.slice(0, 10))}.</p>${sections}`,
    site,
    generatedAt: ctx.generatedAt,
  })
}
