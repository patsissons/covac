import type {
  ActivityDetailBody,
  ApiEnvelope,
  CalendarsBody,
  EventsBody,
  EventsRequest,
  FiltersBody,
} from './api'

export const API_BASE = 'https://anc.ca.apm.activecommunities.com/vancouver/rest/onlinecalendar'

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'covac scraper (+https://github.com/patsissons/covac)',
}

export interface ClientOptions {
  fetch?: typeof fetch
  retries?: number
  /** Base delay in ms for exponential backoff. */
  backoffMs?: number
  log?: (message: string) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class ApiError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Thin typed client for the five ActiveNet calendar endpoints, with retry on failure. */
export function createClient(options: ClientOptions = {}) {
  const doFetch = options.fetch ?? fetch
  const retries = options.retries ?? 3
  const backoffMs = options.backoffMs ?? 1000
  const log = options.log ?? (() => {})

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}locale=en-US`
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = backoffMs * 2 ** (attempt - 1)
        log(`retry ${attempt}/${retries} for ${path} in ${delay}ms`)
        await sleep(delay)
      }
      try {
        const res = await doFetch(url, { ...init, headers: { ...HEADERS, ...init?.headers } })
        if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${path}`, res.status)
        const json = (await res.json()) as ApiEnvelope<T>
        if (json.headers.response_code !== '0000') {
          throw new ApiError(
            `API ${json.headers.response_code} ${json.headers.response_message} for ${path}`,
          )
        }
        return json.body
      } catch (error) {
        lastError = error
        // 4xx other than 429 will not succeed on retry.
        if (error instanceof ApiError && error.status && error.status < 500 && error.status !== 429)
          throw error
      }
    }
    throw lastError
  }

  return {
    calendars: () => request<CalendarsBody>('/calendars'),

    filters: (calendarId: number) =>
      request<FiltersBody>('/filters', {
        method: 'POST',
        body: JSON.stringify({ calendar_id: calendarId }),
      }),

    events: (calendarId: number, centerIds: number[]) => {
      const body: EventsRequest = {
        calendar_id: calendarId,
        center_ids: centerIds,
        display_all: 0,
        search_start_time: '',
        search_end_time: '',
        facility_ids: [],
        activity_category_ids: [],
        activity_sub_category_ids: [],
        activity_ids: [],
        activity_min_age: null,
        activity_max_age: null,
        event_type_ids: [],
      }
      return request<EventsBody>('/multicenter/events', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    /** `selectedDate` is a raw `YYYY-MM-DD HH:mm:ss` start time of one occurrence. */
    activityDetail: (activityId: number, selectedDate: string) =>
      request<ActivityDetailBody>(
        `/activity-details/${activityId}?selected_date=${encodeURIComponent(selectedDate)}`,
      ),
  }
}

export type Client = ReturnType<typeof createClient>
