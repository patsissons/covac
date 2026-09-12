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
    expect(gridCells.corner(true)).toContain('before:rounded-tl-lg before:border-t before:border-l')
    expect(gridCells.columnHeader(true, true)).toContain(
      'before:rounded-tr-lg before:border-t before:border-r',
    )
    expect(gridCells.columnHeader(true, false)).toContain('border-t')
    expect(gridCells.columnHeader(true, false)).not.toContain('border-r')
    expect(gridCells.rowHeader(true)).toContain('border-b border-l')
    expect(gridCells.rowHeader(true)).toContain('group-last/row:before:rounded-bl-lg')
    expect(gridCells.body(true, true)).toContain('border-r group-last/row:rounded-br-lg')
    expect(gridCells.body(true, false)).not.toContain('border-r')
  })

  it('draws sticky-cell corners on a pseudo-element over a square, opaque cell', () => {
    for (const cls of [gridCells.corner(true), gridCells.columnHeader(true, true)]) {
      expect(cls).toContain('bg-background')
      expect(cls).toContain('before:absolute before:inset-0 before:border-border')
      expect(cls).toContain('before:border-t')
      expect(cls).not.toMatch(/(^| )rounded-t|(^| )border-t/)
    }
    const rowHeader = gridCells.rowHeader(true)
    expect(rowHeader).toContain('bg-background')
    expect(rowHeader).toContain('group-last/row:border-b-0 group-last/row:border-l-0')
    expect(rowHeader).toContain('group-last/row:before:border-border')
    expect(rowHeader).not.toMatch(/(^| )rounded-b/)
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
