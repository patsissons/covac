import type { Activity } from '@/types/snapshot'

const DOLLARS = /\$([\d,]+(?:\.\d+)?)/

function dollars(text: string): number | undefined {
  const match = DOLLARS.exec(text)
  return match ? Number(match[1]!.replace(/,/g, '')) : undefined
}

/**
 * Lowest dollar amount an activity is offered at: 0 when free, the amount in its price label,
 * or the cheapest line in its fee table. Undefined when the snapshot carries no price.
 */
export function activityPrice(activity: Activity): number | undefined {
  if (activity.free || activity.priceText === 'Free') return 0
  const direct = dollars(activity.priceText)
  if (direct !== undefined) return direct
  const amounts = (activity.prices ?? [])
    .filter((line) => line.price.startsWith('$'))
    .map((line) => dollars(line.price))
    .filter((n): n is number => n !== undefined)
  return amounts.length ? Math.min(...amounts) : undefined
}

/** Top of the price slider: the highest known price rounded up to the next $50, at least $50. */
export function priceCeiling(prices: Iterable<number>): number {
  let max = 0
  for (const price of prices) if (price > max) max = price
  return Math.max(50, Math.ceil(max / 50) * 50)
}

/** Positions on the price slider run 0–100. */
export const SLIDER_MAX = 100

/**
 * The slider is quadratic so the cheap end, where most drop-ins live, gets most of the track:
 * the midpoint of the track is a quarter of the ceiling.
 */
export function sliderToPrice(position: number, ceiling: number): number {
  const t = Math.min(Math.max(position, 0), SLIDER_MAX) / SLIDER_MAX
  return Math.round(ceiling * t * t)
}

/**
 * Nearest slider position for a price, chosen from the positions' own rounded prices so that a
 * committed price lands back on the position that produced it.
 */
export function priceToSlider(price: number, ceiling: number): number {
  let best = 0
  let bestDistance = Infinity
  for (let position = 0; position <= SLIDER_MAX; position++) {
    const distance = Math.abs(sliderToPrice(position, ceiling) - price)
    if (distance < bestDistance) {
      best = position
      bestDistance = distance
    }
  }
  return best
}

/** `Free`, `$20`, or `$600+` when unbounded above. */
export function formatPrice(price: number | null, ceiling: number): string {
  if (price === null) return `$${ceiling}+`
  if (price === 0) return 'Free'
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`
}

/** Label for a price range with both ends optional. */
export function formatPriceRange(min: number | null, max: number | null, ceiling: number): string {
  if (min !== null && min === max) return formatPrice(min, ceiling)
  return `${formatPrice(min ?? 0, ceiling)} – ${formatPrice(max, ceiling)}`
}
