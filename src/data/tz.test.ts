import { describe, expect, it } from 'vitest'
import { toOffsetIso, vancouverOffset, vancouverToday } from './tz'

describe('vancouverToday', () => {
  it('reports the Vancouver date even when UTC has rolled over', () => {
    // 06:30 UTC on Sep 14 is 23:30 PDT on Sep 13.
    expect(vancouverToday(new Date('2026-09-14T06:30:00Z'))).toBe('2026-09-13')
    expect(vancouverToday(new Date('2026-09-14T18:00:00Z'))).toBe('2026-09-14')
  })
})

describe('vancouverOffset', () => {
  it('is PDT before the November switch and PST after', () => {
    expect(vancouverOffset('2026-10-31T09:00')).toBe('-07:00')
    expect(vancouverOffset('2026-11-02T09:00')).toBe('-08:00')
  })

  it('handles the switch day itself', () => {
    // Clocks fall back at 02:00 on Sunday 2026-11-01.
    expect(vancouverOffset('2026-11-01T01:30')).toBe('-07:00')
    expect(vancouverOffset('2026-11-01T03:00')).toBe('-08:00')
  })

  it('accepts a bare date', () => {
    expect(vancouverOffset('2026-07-01')).toBe('-07:00')
    expect(vancouverOffset('2026-01-15')).toBe('-08:00')
  })
})

describe('toOffsetIso', () => {
  it('appends seconds and the offset', () => {
    expect(toOffsetIso('2026-09-14T07:00')).toBe('2026-09-14T07:00:00-07:00')
    expect(toOffsetIso('2026-12-01T18:45')).toBe('2026-12-01T18:45:00-08:00')
  })
})
