import { cn } from '@/lib/utils'

/**
 * Table classes shared by the week and time grids.
 *
 * The tables use `border-separate` so borders belong to the cells and travel with sticky
 * headers; collapsed borders are painted by the table and stay behind when a cell sticks. In
 * the compact layout the page itself scrolls, so the wrapper cannot clip or frame the table:
 * the outer border and rounded corners live on the edge cells instead, and the pinned header
 * carries its own top edge and corners under the day tabs. Body rows are `group/row` so the
 * corner rounding and zebra tint can target the last and odd rows from their cells.
 *
 * Corners on sticky cells are drawn by a `before` pseudo-element rather than by rounding the
 * cell: a rounded cell clips its own box, and whatever sits behind it shows through the gap
 * outside the curve. Body cells scroll under the pinned column header, and Chrome pins sticky
 * row headers to the table rather than their row, so earlier row headers pile up behind the
 * last one at the bottom of the table. The square cell background hides both and is invisible
 * against the page, which shares the same colour. The cell drops the real borders the pseudo
 * element replaces and pads by their width so its text stays aligned with its neighbours.
 */
const pseudoFrame = 'before:pointer-events-none before:absolute before:inset-0 before:border-border'

export const gridCells = {
  frame: (compact: boolean) =>
    compact ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto rounded-lg border',
  table: 'w-full border-separate border-spacing-0 text-sm',
  row: 'group/row align-top',
  corner: (compact: boolean) =>
    cn(
      'bg-background sticky left-0 z-20 border-r border-b p-2 text-left font-medium',
      compact && cn(pseudoFrame, 'pl-[9px] before:rounded-tl-lg before:border-t before:border-l'),
    ),
  columnHeader: (compact: boolean, last: boolean) =>
    cn(
      'bg-background sticky z-10 border-b p-2 text-left font-medium',
      compact &&
        (last
          ? cn(pseudoFrame, 'before:rounded-tr-lg before:border-t before:border-r')
          : 'border-t'),
    ),
  rowHeader: (compact: boolean) =>
    cn(
      'bg-background sticky left-0 z-10 border-r p-2 text-left font-medium',
      compact
        ? cn(
            'border-b border-l group-last/row:border-b-0 group-last/row:border-l-0 group-last/row:pl-[9px]',
            'group-last/row:before:pointer-events-none group-last/row:before:absolute group-last/row:before:inset-0',
            'group-last/row:before:rounded-bl-lg group-last/row:before:border-b group-last/row:before:border-l',
            'group-last/row:before:border-border',
          )
        : 'border-b group-last/row:border-b-0',
    ),
  body: (compact: boolean, last: boolean) =>
    cn(
      'group-odd/row:bg-muted/30 border-b p-1',
      compact ? last && 'border-r group-last/row:rounded-br-lg' : 'group-last/row:border-b-0',
    ),
}
