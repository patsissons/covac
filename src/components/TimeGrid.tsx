import { useRef } from 'react'
import { dayOfWeek, formatDay, formatTime, today, weekDays, type DateString } from '@/data/dates'
import type { HourDayGrid } from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { useElementHeight } from '@/hooks/useElementHeight'
import { gridCells } from '@/components/gridCells'
import { cn } from '@/lib/utils'
import { DAY_TABS_HEIGHT, DayTabs } from './DayTabs'
import { ActivityChip } from './WeekGrid'

interface TimeGridProps {
  index: SnapshotIndex
  weekStart: DateString
  grid: HourDayGrid
  /** Days of week to show (0 = Sunday); empty means all seven. */
  days: number[]
  onSelect: (activityId: number) => void
  /** Show one day at a time (narrow screens). */
  compact: boolean
  selectedDay: DateString
  onSelectDay: (day: DateString) => void
}

/** Week calendar with hourly rows; every visible location's sessions share the same cells. */
export function TimeGrid({
  index,
  weekStart,
  grid,
  days,
  onSelect,
  compact,
  selectedDay,
  onSelectDay,
}: TimeGridProps) {
  const allDays = weekDays(weekStart)
  const visibleDays = days.length ? allDays.filter((d) => days.includes(dayOfWeek(d))) : allDays
  const columns = compact
    ? [visibleDays.includes(selectedDay) ? selectedDay : visibleDays[0]!]
    : visibleDays
  const hours = hourRange(grid, columns)
  const currentDay = today()
  // In compact mode the page scrolls and the day tabs stick above the table header; row
  // headers stick just below the column header so the current row stays labelled.
  const headRef = useRef<HTMLTableSectionElement>(null)
  const headerTop = compact ? DAY_TABS_HEIGHT : 0
  const rowTop = headerTop + useElementHeight(headRef)

  if (grid.size === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        No sessions match these filters this week.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col', !compact && 'min-h-0 flex-1 gap-2')}>
      {compact && <DayTabs days={visibleDays} selected={columns[0]!} onSelect={onSelectDay} />}
      <div className={gridCells.frame(compact)} data-testid="grid-scroll">
        <table className={gridCells.table}>
          <thead ref={headRef}>
            <tr>
              <th
                scope="col"
                style={{ top: headerTop }}
                className={cn(gridCells.corner(compact), 'w-20')}
              >
                Time
              </th>
              {columns.map((day, i) => (
                <th
                  key={day}
                  scope="col"
                  style={{ top: headerTop }}
                  className={cn(
                    gridCells.columnHeader(compact, i === columns.length - 1),
                    'min-w-44',
                    day === currentDay && 'text-primary underline decoration-2 underline-offset-4',
                  )}
                >
                  {formatDay(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour} className={gridCells.row}>
                <th
                  scope="row"
                  style={{ top: rowTop }}
                  className={cn(gridCells.rowHeader(compact), 'whitespace-nowrap tabular-nums')}
                >
                  {formatHour(hour)}
                </th>
                {columns.map((day, i) => (
                  <td key={day} className={gridCells.body(compact, i === columns.length - 1)}>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1">
                      {(grid.get(hour)?.get(day) ?? []).map((occurrence) => (
                        <li key={`${occurrence.a}-${occurrence.s}`}>
                          <ActivityChip
                            index={index}
                            occurrence={occurrence}
                            onSelect={onSelect}
                            showLocation
                          />
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {compact && hours.length === 0 && (
        <p className="text-muted-foreground p-4 text-center text-sm">
          Nothing on {formatDay(columns[0]!)}.
        </p>
      )}
    </div>
  )
}

/** Every hour from the earliest to the latest session start in the visible columns. */
function hourRange(grid: HourDayGrid, columns: DateString[]): number[] {
  let min = 24
  let max = -1
  for (const [hour, days] of grid) {
    if (!columns.some((day) => days.has(day))) continue
    if (hour < min) min = hour
    if (hour > max) max = hour
  }
  if (max < 0) return []
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

/** 16 → `4 pm`. */
function formatHour(hour: number): string {
  return formatTime(`${String(hour).padStart(2, '0')}:00`).replace(':00', '')
}
