import { useRef } from 'react'
import {
  addDays,
  dayOfWeek,
  formatDay,
  formatTime,
  timeOf,
  today,
  weekDays,
  type DateString,
} from '@/data/dates'
import type { CenterDayGrid } from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { groupStyle } from '@/lib/groupColor'
import { useElementHeight } from '@/hooks/useElementHeight'
import { cn } from '@/lib/utils'
import { DAY_TABS_HEIGHT, DayTabs } from './DayTabs'
import type { Occurrence } from '@/types/snapshot'

interface WeekGridProps {
  index: SnapshotIndex
  weekStart: DateString
  grid: CenterDayGrid
  /** Days of week to show (0 = Sunday); empty means all seven. */
  days: number[]
  onSelect: (activityId: number) => void
  /** Show one day at a time (narrow screens). */
  compact: boolean
  selectedDay: DateString
  onSelectDay: (day: DateString) => void
}

export function WeekGrid({
  index,
  weekStart,
  grid,
  days,
  onSelect,
  compact,
  selectedDay,
  onSelectDay,
}: WeekGridProps) {
  const allDays = weekDays(weekStart)
  const visibleDays = days.length ? allDays.filter((d) => days.includes(dayOfWeek(d))) : allDays
  const columns = compact
    ? [visibleDays.includes(selectedDay) ? selectedDay : visibleDays[0]!]
    : visibleDays
  const centers = [...grid.keys()]
    .map((id) => index.centerById.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
  const rows = compact ? centers.filter((c) => grid.get(c.id)?.has(columns[0]!)) : centers
  const currentDay = today()
  // In compact mode the page scrolls and the day tabs stick above the table header; row
  // headers stick just below the column header so the current row stays labelled.
  const headRef = useRef<HTMLTableSectionElement>(null)
  const headerTop = compact ? DAY_TABS_HEIGHT : 0
  const rowTop = headerTop + useElementHeight(headRef)

  if (centers.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        No sessions match these filters this week.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col', !compact && 'min-h-0 flex-1 gap-2')}>
      {compact && <DayTabs days={visibleDays} selected={columns[0]!} onSelect={onSelectDay} />}
      <div
        className={cn(
          'rounded-lg border',
          compact ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto',
        )}
        data-testid="grid-scroll"
      >
        <table className="w-full border-collapse text-sm">
          <thead ref={headRef}>
            <tr>
              <th
                scope="col"
                style={{ top: headerTop }}
                className={cn(
                  'bg-background sticky left-0 z-20 min-w-36 border-r border-b p-2 text-left font-medium',
                )}
              >
                Location
              </th>
              {columns.map((day) => (
                <th
                  key={day}
                  scope="col"
                  style={{ top: headerTop }}
                  className={cn(
                    'bg-background sticky z-10 min-w-40 border-b p-2 text-left font-medium',
                    day === currentDay && 'text-primary underline decoration-2 underline-offset-4',
                  )}
                >
                  {formatDay(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((center) => (
              <tr key={center.id} className="odd:bg-muted/30 align-top">
                <th
                  scope="row"
                  style={{ top: rowTop }}
                  className="bg-background sticky left-0 z-10 border-r border-b p-2 text-left font-medium"
                >
                  {center.name}
                </th>
                {columns.map((day) => (
                  <td key={day} className="border-b p-1">
                    <ul className="flex flex-col gap-1">
                      {(grid.get(center.id)?.get(day) ?? []).map((occurrence) => (
                        <li key={`${occurrence.a}-${occurrence.s}`}>
                          <ActivityChip index={index} occurrence={occurrence} onSelect={onSelect} />
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
      {compact && rows.length === 0 && (
        <p className="text-muted-foreground p-4 text-center text-sm">
          Nothing on {formatDay(columns[0]!)}. Try {formatDay(addDays(columns[0]!, 1))}.
        </p>
      )}
    </div>
  )
}

interface ActivityChipProps {
  index: SnapshotIndex
  occurrence: Occurrence
  onSelect: (activityId: number) => void
  /** Add the centre name, for views where the row does not identify it. */
  showLocation?: boolean
}

export function ActivityChip({
  index,
  occurrence,
  onSelect,
  showLocation = false,
}: ActivityChipProps) {
  const activity = index.activityById.get(occurrence.a)
  if (!activity) return null
  const group = index.calendarById.get(activity.calendarId)?.group ?? ''
  const center = showLocation ? index.centerById.get(activity.centerId) : undefined
  return (
    <button
      type="button"
      onClick={() => onSelect(activity.id)}
      className={cn(
        'flex w-full flex-col rounded-md px-2 py-1 text-left text-xs leading-tight transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        groupStyle(group).chip,
      )}
    >
      <span className="font-medium tabular-nums">
        {formatTime(timeOf(occurrence.s))}–{formatTime(timeOf(occurrence.e))}
      </span>
      <span data-slot="title">{activity.title}</span>
      <span className="flex flex-wrap justify-between gap-x-2 opacity-70">
        {center ? <span>{center.name}</span> : <span />}
        {activity.priceText && (
          <span className="shrink-0 font-medium tabular-nums">{activity.priceText}</span>
        )}
      </span>
    </button>
  )
}
