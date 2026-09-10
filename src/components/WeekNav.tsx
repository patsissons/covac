import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addDays, formatDate, startOfWeek, today, type DateString } from '@/data/dates'

interface WeekNavProps {
  weekStart: DateString
  period: { start: DateString; end: DateString }
  onChange: (weekStart: DateString) => void
}

export function WeekNav({ weekStart, period, onChange }: WeekNavProps) {
  const firstWeek = startOfWeek(period.start)
  const lastWeek = startOfWeek(period.end)
  const thisWeek = startOfWeek(today())
  const weekEnd = addDays(weekStart, 6)

  return (
    <nav aria-label="Week" className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous week"
        disabled={weekStart <= firstWeek}
        onClick={() => onChange(addDays(weekStart, -7))}
      >
        <ChevronLeft />
      </Button>
      <h2 className="min-w-48 text-center text-lg font-semibold tabular-nums">
        {formatDate(weekStart)} – {formatDate(weekEnd)}
      </h2>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next week"
        disabled={weekStart >= lastWeek}
        onClick={() => onChange(addDays(weekStart, 7))}
      >
        <ChevronRight />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={weekStart === thisWeek || thisWeek < firstWeek || thisWeek > lastWeek}
        onClick={() => onChange(thisWeek)}
      >
        This week
      </Button>
    </nav>
  )
}
