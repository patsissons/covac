import { Check, ChevronsUpDown, Minus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DAY_LABELS, formatTime } from '@/data/dates'
import {
  emptyFilters,
  groupSelection,
  hasActiveFilters,
  toggleCalendarGroup,
  type Filters,
} from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { groupStyle } from '@/lib/groupColor'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  index: SnapshotIndex
  filters: Filters
  onChange: (filters: Filters) => void
  resultCount: number
}

/** Half-hour slots from 6:00 to 22:00 for the time-of-day selects. */
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const ANY = '__any'

// Monday-first display order; values are Date.getDay() numbers.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function FilterBar({ index, filters, onChange, resultCount }: FilterBarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Calendars"
          placeholder="Search calendars…"
          selected={filters.calendarIds}
          onChange={(calendarIds) => set({ calendarIds })}
          onToggleGroup={(group) =>
            set({ calendarIds: toggleCalendarGroup(index, filters.calendarIds, group) })
          }
          groupSelection={(group) => groupSelection(index, filters.calendarIds, group)}
          groups={index.groups.map((group) => ({
            label: group,
            items: index.snapshot.calendars
              .filter((c) => c.group === group)
              .map((c) => ({ id: c.id, label: c.name, dot: groupStyle(group).dot })),
          }))}
        />
        <MultiSelect
          label="Centres"
          placeholder="Search centres…"
          selected={filters.centerIds}
          onChange={(centerIds) => set({ centerIds })}
          groups={[
            {
              label: 'Centres',
              items: index.snapshot.centers.map((c) => ({ id: c.id, label: c.name })),
            },
          ]}
        />
        <div className="flex items-center gap-1">
          <TimeSelect
            label="From"
            value={filters.from}
            onChange={(from) => set({ from })}
            max={filters.to}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <TimeSelect
            label="To"
            value={filters.to}
            onChange={(to) => set({ to })}
            min={filters.from}
          />
        </div>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          aria-label="Days of week"
          value={filters.days.map(String)}
          onValueChange={(values) => set({ days: values.map(Number).sort((a, b) => a - b) })}
        >
          {DAY_ORDER.map((day) => (
            <ToggleGroupItem key={day} value={String(day)} aria-label={DAY_LABELS[day]}>
              {DAY_LABELS[day]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative min-w-40 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            aria-label="Search activities"
            placeholder="Search activities or instructors"
            className="pl-8"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <span aria-live="polite">
          {resultCount.toLocaleString()} {resultCount === 1 ? 'session' : 'sessions'} this week
        </span>
        {hasActiveFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters(filters.weekStart))}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}

interface MultiSelectProps {
  label: string
  placeholder: string
  selected: number[]
  onChange: (ids: number[]) => void
  groups: { label: string; items: { id: number; label: string; dot?: string }[] }[]
  /** When given, each group gets an "All …" row that toggles the whole group. */
  onToggleGroup?: (group: string) => void
  groupSelection?: (group: string) => 'all' | 'some' | 'none'
}

function MultiSelect({
  label,
  placeholder,
  selected,
  onChange,
  groups,
  onToggleGroup,
  groupSelection,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedSet = new Set(selected)
  const toggle = (id: number) =>
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label={label}>
          {label}
          {selected.length > 0 && <Badge variant="secondary">{selected.length}</Badge>}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {onToggleGroup && group.items.length > 1 && (
                  <CommandItem
                    value={`All ${group.label} ${group.label}`}
                    onSelect={() => onToggleGroup(group.label)}
                    className="font-medium"
                  >
                    <GroupCheck state={groupSelection?.(group.label) ?? 'none'} />
                    All {group.label}
                  </CommandItem>
                )}
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.id}`}
                    onSelect={() => toggle(item.id)}
                    aria-selected={selectedSet.has(item.id)}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        selectedSet.has(item.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {item.dot && <span className={cn('size-2 rounded-full', item.dot)} />}
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                Clear {label.toLowerCase()}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function GroupCheck({ state }: { state: 'all' | 'some' | 'none' }) {
  if (state === 'some') return <Minus className="size-4" aria-label="partially selected" />
  return <Check className={cn('size-4', state === 'all' ? 'opacity-100' : 'opacity-0')} />
}

interface TimeSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

function TimeSelect({ label, value, onChange, min, max }: TimeSelectProps) {
  return (
    <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? '' : v)}>
      <SelectTrigger aria-label={label} className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label === 'From' ? 'Any time' : 'Any time'}</SelectItem>
        {TIME_OPTIONS.filter((t) => (!min || t >= min) && (!max || t <= max)).map((t) => (
          <SelectItem key={t} value={t}>
            {formatTime(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
