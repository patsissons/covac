import { Button } from '@/components/ui/button'
import {
  DAY_LABELS,
  dayOfWeek,
  formatDay,
  formatTime,
  today,
  weekDays,
  type DateString,
} from '@/data/dates'
import type { HourDayGrid } from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { cn } from '@/lib/utils'
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

  if (grid.size === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        No sessions match these filters this week.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {compact && (
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Day">
          {visibleDays.map((day) => (
            <Button
              key={day}
              role="tab"
              aria-selected={day === columns[0]}
              variant={day === columns[0] ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectDay(day)}
            >
              {DAY_LABELS[dayOfWeek(day)]} {Number(day.slice(8))}
            </Button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-background sticky top-0 left-0 z-20 w-20 border-r border-b p-2 text-left font-medium"
              >
                Time
              </th>
              {columns.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={cn(
                    'bg-background sticky top-0 z-10 min-w-44 border-b p-2 text-left font-medium',
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
              <tr key={hour} className="odd:bg-muted/30 align-top">
                <th
                  scope="row"
                  className="bg-background sticky left-0 z-10 border-r border-b p-2 text-left font-medium whitespace-nowrap tabular-nums"
                >
                  {formatHour(hour)}
                </th>
                {columns.map((day) => (
                  <td key={day} className="border-b p-1">
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
