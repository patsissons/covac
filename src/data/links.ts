/** Canonical covac.fyi URLs: prerendered pages and shareable calendar deep links. */
import { startOfWeek, type DateString } from './dates'
import { emptyFilters, type Filters } from './filters'
import { filtersToSearch } from './url'

export const SITE_URL = 'https://covac.fyi'

export const activityPagePath = (id: number) => `/activities/${id}/`
export const centrePagePath = (id: number) => `/centres/${id}/`

export const activityPageUrl = (id: number, site = SITE_URL) => `${site}${activityPagePath(id)}`
export const centrePageUrl = (id: number, site = SITE_URL) => `${site}${centrePagePath(id)}`

/**
 * A link into the calendar with the given filters applied. Unlike the app's own URL state, the
 * week is always spelled out so the link means the same thing whenever it is opened.
 */
export function deepLink(
  filters: Partial<Filters> & { weekStart: DateString },
  site = SITE_URL,
): string {
  const full: Filters = { ...emptyFilters(startOfWeek(filters.weekStart)), ...filters }
  full.weekStart = startOfWeek(filters.weekStart)
  return `${site}/${filtersToSearch(full, '')}`
}

/**
 * Calendar link that opens one activity's detail panel, showing its centre in the week of a
 * session and filtered to its title.
 */
export function activityDeepLink(
  activity: { id: number; title: string; centerId: number },
  session: DateString,
  site = SITE_URL,
): string {
  return deepLink(
    {
      weekStart: session,
      centerIds: [activity.centerId],
      q: activity.title,
      activity: activity.id,
    },
    site,
  )
}
