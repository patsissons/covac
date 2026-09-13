import type { Activity } from '@/types/snapshot'

type Availability = Pick<Activity, 'availability' | 'spaces'>

/**
 * Whether registration is still possible. Full, closed and cancelled activities are not;
 * activities the scraper could not classify count as available so nothing is hidden by mistake.
 */
export function isAvailable(activity: Pick<Activity, 'availability'>): boolean {
  const { availability } = activity
  return availability !== 'full' && availability !== 'closed' && availability !== 'cancelled'
}

/** Short openings label for calendar chips: `12 left`, `Unlimited`, `Full`, `Closed`, `Cancelled`. */
export function availabilityLabel(activity: Availability): string | undefined {
  switch (activity.availability) {
    case 'open':
      return activity.spaces === undefined ? 'Unlimited' : `${activity.spaces} left`
    case 'full':
      return 'Full'
    case 'closed':
      return 'Closed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return undefined
  }
}
