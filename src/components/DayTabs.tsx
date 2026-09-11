import { Button } from '@/components/ui/button'
import { DAY_LABELS, dayOfWeek, type DateString } from '@/data/dates'

interface DayTabsProps {
  days: DateString[]
  selected: DateString
  onSelect: (day: DateString) => void
}

/**
 * One tab per visible day for the single-day (compact) layout. The strip sticks to the top of
 * the viewport while the page scrolls through the grid so the day can be switched from anywhere
 * in the table. It is `DAY_TABS_HEIGHT` tall including its bottom padding; sticky table headers
 * below it offset by that much so they tuck underneath instead of overlapping.
 */
export function DayTabs({ days, selected, onSelect }: DayTabsProps) {
  return (
    <div
      className="bg-background sticky top-0 z-30 flex items-center gap-1 overflow-x-auto pb-2"
      role="tablist"
      aria-label="Day"
    >
      {days.map((day) => (
        <Button
          key={day}
          role="tab"
          aria-selected={day === selected}
          variant={day === selected ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(day)}
        >
          {DAY_LABELS[dayOfWeek(day)]} {Number(day.slice(8))}
        </Button>
      ))}
    </div>
  )
}

/** Tailwind `top-*` offset matching the tab strip: a 28px `sm` button plus 8px padding. */
export const DAY_TABS_HEIGHT = 'top-9'
