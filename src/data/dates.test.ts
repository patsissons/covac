import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOfWeek,
  formatDay,
  formatTime,
  isDateString,
  startOfWeek,
  toMinutes,
  weekDays,
} from './dates'

describe('dates', () => {
  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-09-09')).toBe('2026-09-07') // Wednesday
    expect(startOfWeek('2026-09-13')).toBe('2026-09-07') // Sunday
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07') // Monday
  })

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('lists the seven days of a week', () => {
    const days = weekDays('2026-09-07')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-09-07')
    expect(days[6]).toBe('2026-09-13')
    expect(dayOfWeek(days[6]!)).toBe(0)
  })

  it('formats days and times for display', () => {
    expect(formatDay('2026-09-14')).toBe('Mon Sep 14')
    expect(formatTime('14:05')).toBe('2:05 pm')
    expect(formatTime('00:30')).toBe('12:30 am')
    expect(formatTime('12:00')).toBe('12:00 pm')
    expect(toMinutes('09:30')).toBe(570)
  })

  it('validates date strings', () => {
    expect(isDateString('2026-09-14')).toBe(true)
    expect(isDateString('2026-9-14')).toBe(false)
    expect(isDateString(null)).toBe(false)
  })
})
