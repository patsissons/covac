import { describe, expect, it, vi } from 'vitest'
import { ApiError, createClient } from './client'

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>
const mockFetch = (impl: FetchFn) => vi.fn<FetchFn>(impl)

const ok = (body: unknown) =>
  new Response(
    JSON.stringify({ headers: { response_code: '0000', response_message: 'Successful' }, body }),
    { status: 200 },
  )

describe('createClient', () => {
  it('appends the locale and unwraps the body', async () => {
    const fetchMock = mockFetch(async () => ok({ calendars: [] }))
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch })
    await expect(client.calendars()).resolves.toEqual({ calendars: [] })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://anc.ca.apm.activecommunities.com/vancouver/rest/onlinecalendar/calendars?locale=en-US',
    )
  })

  it('posts the full events request body', async () => {
    const fetchMock = mockFetch(async () => ok({ center_events: [] }))
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch })
    await client.events(55, [37, 59])
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      calendar_id: 55,
      center_ids: [37, 59],
      display_all: 0,
      event_type_ids: [],
    })
  })

  it('encodes the selected date for activity details', async () => {
    const fetchMock = mockFetch(async () => ok({ activity_detail: {} }))
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch })
    await client.activityDetail(526347, '2026-09-15 14:00:00')
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      '/activity-details/526347?selected_date=2026-09-15%2014%3A00%3A00&locale=en-US',
    )
  })

  it('retries server errors with backoff and then succeeds', async () => {
    const fetchMock = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(ok({ calendars: [1] }))
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch, backoffMs: 1 })
    await expect(client.calendars()).resolves.toEqual({ calendars: [1] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry client errors', async () => {
    const fetchMock = mockFetch(async () => new Response('nope', { status: 404 }))
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch, backoffMs: 1 })
    await expect(client.calendars()).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a non-0000 response code as an error', async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(
          JSON.stringify({ headers: { response_code: '9999', response_message: 'Bad' }, body: {} }),
        ),
    )
    const client = createClient({
      fetch: fetchMock as unknown as typeof fetch,
      retries: 0,
    })
    await expect(client.calendars()).rejects.toThrow(/9999 Bad/)
  })
})
