import { describe, expect, it } from 'vitest'
import { availabilityLabel, isAvailable } from './availability'

describe('isAvailable', () => {
  it('is false only for full, closed and cancelled', () => {
    expect(isAvailable({ availability: 'open' })).toBe(true)
    expect(isAvailable({})).toBe(true)
    expect(isAvailable({ availability: 'full' })).toBe(false)
    expect(isAvailable({ availability: 'closed' })).toBe(false)
    expect(isAvailable({ availability: 'cancelled' })).toBe(false)
  })
})

describe('availabilityLabel', () => {
  it.each([
    [{ availability: 'open', spaces: 12 }, '12 left'],
    [{ availability: 'open', spaces: 1 }, '1 left'],
    [{ availability: 'open' }, 'Unlimited'],
    [{ availability: 'full', spaces: 0 }, 'Full'],
    [{ availability: 'closed' }, 'Closed'],
    [{ availability: 'cancelled' }, 'Cancelled'],
    [{}, undefined],
  ] as const)('labels %j as %s', (activity, expected) => {
    expect(availabilityLabel(activity)).toBe(expected)
  })
})
