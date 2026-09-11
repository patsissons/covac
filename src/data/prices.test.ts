import { describe, expect, it } from 'vitest'
import type { Activity } from '@/types/snapshot'
import {
  activityPrice,
  formatPrice,
  formatPriceRange,
  priceCeiling,
  priceToSlider,
  SLIDER_MAX,
  sliderToPrice,
} from './prices'

const activity = (patch: Partial<Activity>): Activity => ({
  id: 1,
  title: '',
  calendarId: 1,
  centerId: 1,
  facilityIds: [],
  url: '',
  description: '',
  instructors: [],
  priceText: '',
  free: false,
  ...patch,
})

describe('activityPrice', () => {
  it('reads free, direct, "from" and fee-table prices', () => {
    expect(activityPrice(activity({ free: true, priceText: '' }))).toBe(0)
    expect(activityPrice(activity({ priceText: 'Free' }))).toBe(0)
    expect(activityPrice(activity({ priceText: '$7.93' }))).toBe(7.93)
    expect(activityPrice(activity({ priceText: 'from $1,112.00' }))).toBe(1112)
    expect(
      activityPrice(
        activity({
          prices: [
            { price: '50.00%', description: 'Discount' },
            { price: '$40.00', description: 'Pass' },
            { price: '$5.00', description: 'Drop-in' },
          ],
        }),
      ),
    ).toBe(5)
  })

  it('is undefined when nothing in the snapshot says', () => {
    expect(activityPrice(activity({}))).toBeUndefined()
    expect(activityPrice(activity({ priceText: 'Check details for fees' }))).toBeUndefined()
  })
})

describe('price slider mapping', () => {
  it('rounds the ceiling up to the next $50 with a $50 floor', () => {
    expect(priceCeiling([])).toBe(50)
    expect(priceCeiling([12, 585])).toBe(600)
    expect(priceCeiling([100])).toBe(100)
  })

  it('maps the ends exactly and the middle to a quarter of the ceiling', () => {
    expect(sliderToPrice(0, 600)).toBe(0)
    expect(sliderToPrice(SLIDER_MAX, 600)).toBe(600)
    expect(sliderToPrice(SLIDER_MAX / 2, 600)).toBe(150)
    expect(priceToSlider(0, 600)).toBe(0)
    expect(priceToSlider(600, 600)).toBe(SLIDER_MAX)
    expect(priceToSlider(150, 600)).toBe(SLIDER_MAX / 2)
    expect(priceToSlider(9999, 600)).toBe(SLIDER_MAX)
  })

  it('round-trips every position through its price', () => {
    for (const ceiling of [50, 600]) {
      for (let position = 0; position <= SLIDER_MAX; position++) {
        const back = priceToSlider(sliderToPrice(position, ceiling), ceiling)
        // Positions that share a rounded dollar amount collapse to the lowest of them.
        expect(sliderToPrice(back, ceiling)).toBe(sliderToPrice(position, ceiling))
        expect(back).toBeLessThanOrEqual(position)
      }
    }
  })

  it('formats bounds and ranges', () => {
    expect(formatPrice(0, 600)).toBe('Free')
    expect(formatPrice(20, 600)).toBe('$20')
    expect(formatPrice(7.5, 600)).toBe('$7.50')
    expect(formatPrice(null, 600)).toBe('$600+')
    expect(formatPriceRange(null, null, 600)).toBe('Free – $600+')
    expect(formatPriceRange(10, 50, 600)).toBe('$10 – $50')
    expect(formatPriceRange(null, 0, 600)).toBe('Free – Free')
    expect(formatPriceRange(0, 0, 600)).toBe('Free')
  })
})
