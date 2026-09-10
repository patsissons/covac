import { buildIndex } from '@/data/index'
import type { Snapshot } from '@/types/snapshot'

/** Small in-memory snapshot for component tests: two centres, two calendars, week of 2026-09-07. */
export const snapshot: Snapshot = {
  generatedAt: '2026-09-09T02:00:00.000Z',
  period: { start: '2026-09-06', end: '2026-11-01' },
  calendars: [
    { id: 55, name: 'Public Swimming', group: 'Drop-in' },
    { id: 10, name: 'Sports: Basketball', group: 'Sports' },
  ],
  centers: [
    {
      id: 37,
      name: 'Britannia Pool',
      address: '1661 Napier Street, Vancouver',
      phone: '(604) 718-5831',
      lat: 49.2756,
      lng: -123.0707,
    },
    { id: 44, name: 'Hastings Community Centre', lat: 49.2807, lng: -123.0394 },
  ],
  facilities: [{ id: 207, name: 'Britannia Pool', centerId: 37 }],
  activities: [
    {
      id: 1,
      title: 'Free Swim',
      calendarId: 55,
      centerId: 37,
      facilityIds: [207],
      url: 'https://example.com/free-swim/1',
      description: '<p>Recreational swim for <b>everyone</b>.</p>',
      instructors: ['Ada Lovelace'],
      priceText: 'Free',
      free: true,
      ageText: 'All ages',
      openings: '100 openings remaining',
      firstDate: '2026-09-01',
      lastDate: '2026-11-10',
    },
    {
      id: 2,
      title: 'Basketball Drop-in',
      calendarId: 10,
      centerId: 44,
      facilityIds: [],
      url: 'https://example.com/basketball/2',
      description: '',
      instructors: [],
      priceText: '$5.00',
      free: false,
    },
  ],
  occurrences: [
    { a: 1, s: '2026-09-07T07:00', e: '2026-09-07T08:00' },
    { a: 1, s: '2026-09-08T14:00', e: '2026-09-08T16:00' },
    { a: 2, s: '2026-09-12T18:00', e: '2026-09-12T20:00' },
  ],
}

export const index = buildIndex(snapshot)
