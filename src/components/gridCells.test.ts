import { describe, expect, it } from 'vitest'
import { gridCells } from '@/components/gridCells'

describe('gridCells', () => {
  it('uses separate borders so they travel with sticky cells', () => {
    expect(gridCells.table).toContain('border-separate')
    expect(gridCells.table).not.toContain('border-collapse')
  })

  it('frames and clips the table in the wide layout only', () => {
    expect(gridCells.frame(false)).toContain('rounded-lg border')
    expect(gridCells.frame(false)).toContain('overflow-auto')
    expect(gridCells.frame(true)).toBe('overflow-visible')
  })

  it('moves the outer border and corners onto the edge cells in compact mode', () => {
    expect(gridCells.corner(true)).toContain('rounded-tl-lg border-t border-l')
    expect(gridCells.columnHeader(true, true)).toContain('border-t')
    expect(gridCells.columnHeader(true, true)).toContain('rounded-tr-lg border-r')
    expect(gridCells.columnHeader(true, false)).not.toContain('border-r')
    expect(gridCells.rowHeader(true)).toContain('border-l group-last/row:rounded-bl-lg')
    expect(gridCells.body(true, true)).toContain('border-r group-last/row:rounded-br-lg')
    expect(gridCells.body(true, false)).not.toContain('border-r')
  })

  it('leaves the wrapper to draw the outer edge in the wide layout', () => {
    for (const cls of [
      gridCells.corner(false),
      gridCells.columnHeader(false, true),
      gridCells.rowHeader(false),
      gridCells.body(false, true),
    ]) {
      expect(cls).not.toMatch(/rounded|border-t|border-l/)
    }
    expect(gridCells.rowHeader(false)).toContain('group-last/row:border-b-0')
    expect(gridCells.body(false, true)).toContain('group-last/row:border-b-0')
  })
})
