import { groupSelection } from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { groupStyle } from '@/lib/groupColor'
import { cn } from '@/lib/utils'

interface LegendProps {
  index: SnapshotIndex
  calendarIds: number[]
  onToggleGroup: (group: string) => void
}

/** Colour key for calendar groups; each pip toggles every calendar in its group. */
export function Legend({ index, calendarIds, onToggleGroup }: LegendProps) {
  const filtering = calendarIds.length > 0
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-1 text-xs" aria-label="Calendar groups">
      {index.groups.map((group) => {
        const state = groupSelection(index, calendarIds, group)
        const active = !filtering || state !== 'none'
        return (
          <li key={group}>
            <button
              type="button"
              aria-pressed={state === 'all'}
              title={state === 'all' ? `Hide ${group} calendars` : `Show only ${group} calendars`}
              onClick={() => onToggleGroup(group)}
              className={cn(
                'hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors',
                state === 'all' && 'bg-accent text-foreground',
                !active && 'opacity-40',
              )}
            >
              <span className={cn('size-2.5 rounded-full', groupStyle(group).dot)} />
              {group}
              {state === 'some' && <span className="sr-only">(partially selected)</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
