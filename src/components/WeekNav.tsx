import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  addDays,
  formatDate,
  parseDate,
  startOfWeek,
  toDateString,
  today,
  type DateString,
} from '@/data/dates'

interface WeekNavProps {
  weekStart: DateString
  period: { start: DateString; end: DateString }
  /** `day` is the specific day the user chose, when they picked one from the calendar. */
  onChange: (weekStart: DateString, day?: DateString) => void
}

export function WeekNav({ weekStart, period, onChange }: WeekNavProps) {
  const [open, setOpen] = useState(false)
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto px-2 text-lg font-semibold tabular-nums"
            aria-label="Choose a day"
          >
            <h2>
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </h2>
            <CalendarDays className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            weekStartsOn={1}
            defaultMonth={parseDate(weekStart)}
            selected={parseDate(weekStart)}
            modifiers={{ week: { from: parseDate(weekStart), to: parseDate(weekEnd) } }}
            modifiersClassNames={{ week: 'bg-accent' }}
            disabled={{ before: parseDate(period.start), after: parseDate(period.end) }}
            onSelect={(date) => {
              if (!date) return
              const day = toDateString(date)
              onChange(startOfWeek(day), day)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
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
        onClick={() => onChange(thisWeek, today())}
      >
        This week
      </Button>
    </nav>
  )
}
