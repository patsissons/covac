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
 */
export const gridCells = {
  frame: (compact: boolean) =>
    compact ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto rounded-lg border',
  table: 'w-full border-separate border-spacing-0 text-sm',
  row: 'group/row align-top',
  corner: (compact: boolean) =>
    cn(
      'bg-background sticky left-0 z-20 border-r border-b p-2 text-left font-medium',
      compact && 'rounded-tl-lg border-t border-l',
    ),
  columnHeader: (compact: boolean, last: boolean) =>
    cn(
      'bg-background sticky z-10 border-b p-2 text-left font-medium',
      compact && 'border-t',
      compact && last && 'rounded-tr-lg border-r',
    ),
  rowHeader: (compact: boolean) =>
    cn(
      'bg-background sticky left-0 z-10 border-r border-b p-2 text-left font-medium',
      compact ? 'border-l group-last/row:rounded-bl-lg' : 'group-last/row:border-b-0',
    ),
  body: (compact: boolean, last: boolean) =>
    cn(
      'group-odd/row:bg-muted/30 border-b p-1',
      compact ? last && 'border-r group-last/row:rounded-br-lg' : 'group-last/row:border-b-0',
    ),
}
