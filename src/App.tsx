import { Clock, Map as MapIcon, MapPin } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ActivityPanel } from '@/components/ActivityPanel'
import { FilterBar } from '@/components/FilterBar'
import { TimeGrid } from '@/components/TimeGrid'
import { WeekGrid } from '@/components/WeekGrid'
import { WeekNav } from '@/components/WeekNav'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { startOfWeek, today, type DateString } from '@/data/dates'
import {
  applyFilters,
  groupByCenterAndDay,
  groupByHourAndDay,
  visibleCenterIds,
  type ViewMode,
} from '@/data/filters'
import type { SnapshotIndex } from '@/data/index'
import { useSnapshot } from '@/data/useSnapshot'
import { useUrlFilters } from '@/data/useUrlFilters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { groupStyle } from '@/lib/groupColor'
import { cn } from '@/lib/utils'

const CenterMap = lazy(() =>
  import('@/components/CenterMap').then((m) => ({ default: m.CenterMap })),
)

export function App() {
  const state = useSnapshot()

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">covac</h1>
          <p className="text-muted-foreground text-sm">
            City of Vancouver Active Communities: every recreation centre, one week at a time.
          </p>
        </div>
        {state.status === 'ready' && (
          <p className="text-muted-foreground text-xs">
            Data from ActiveNet as of{' '}
            {new Date(state.index.snapshot.generatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        )}
      </header>
      {state.status === 'loading' && <p className="text-muted-foreground">Loading activities…</p>}
      {state.status === 'error' && (
        <p role="alert" className="text-destructive">
          Could not load activity data: {state.error}
        </p>
      )}
      {state.status === 'ready' && <Calendar index={state.index} />}
    </div>
  )
}

function Calendar({ index }: { index: SnapshotIndex }) {
  const defaultWeek = useMemo(() => clampWeek(startOfWeek(today()), index), [index])
  const [filters, setFilters] = useUrlFilters(defaultWeek)
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<DateString>(today())
  const [showMap, setShowMap] = useState(false)
  const compact = useMediaQuery('(max-width: 700px)')

  const occurrences = useMemo(() => applyFilters(index, filters), [index, filters])
  const grid = useMemo(() => groupByCenterAndDay(index, occurrences), [index, occurrences])
  const hourGrid = useMemo(() => groupByHourAndDay(occurrences), [occurrences])
  const centerIds = useMemo(() => visibleCenterIds(index, occurrences), [index, occurrences])
  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const [centerId, days] of grid) {
      let n = 0
      for (const list of days.values()) n += list.length
      map.set(centerId, n)
    }
    return map
  }, [grid])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WeekNav
          weekStart={filters.weekStart}
          period={index.snapshot.period}
          onChange={(weekStart, day) => {
            setFilters({ ...filters, weekStart })
            if (day) setSelectedDay(day)
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="View"
            value={filters.view}
            onValueChange={(view) => view && setFilters({ ...filters, view: view as ViewMode })}
          >
            <ToggleGroupItem value="time" aria-label="By time">
              <Clock /> By time
            </ToggleGroupItem>
            <ToggleGroupItem value="location" aria-label="By location">
              <MapPin /> By location
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
          >
            <MapIcon /> {showMap ? 'Hide map' : 'Show map'}
          </Button>
        </div>
      </div>
      <FilterBar
        index={index}
        filters={filters}
        onChange={setFilters}
        resultCount={occurrences.length}
      />
      {showMap && (
        <Suspense fallback={<div className="bg-muted h-80 animate-pulse rounded-lg" />}>
          <CenterMap
            index={index}
            counts={counts}
            selectedCenterIds={filters.centerIds}
            onToggleCenter={(id) =>
              setFilters({
                ...filters,
                centerIds: filters.centerIds.includes(id)
                  ? filters.centerIds.filter((c) => c !== id)
                  : [...filters.centerIds, id],
              })
            }
          />
        </Suspense>
      )}
      <Legend groups={index.groups} />
      {filters.view === 'time' ? (
        <>
          <VisibleLocations
            index={index}
            centerIds={centerIds}
            onSelect={(id) => setFilters({ ...filters, centerIds: [id] })}
          />
          <TimeGrid
            index={index}
            weekStart={filters.weekStart}
            grid={hourGrid}
            days={filters.days}
            onSelect={setSelectedActivity}
            compact={compact}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </>
      ) : (
        <WeekGrid
          index={index}
          weekStart={filters.weekStart}
          grid={grid}
          days={filters.days}
          onSelect={setSelectedActivity}
          compact={compact}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}
      <ActivityPanel
        index={index}
        activityId={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <footer className="text-muted-foreground mt-4 text-xs">
        Unofficial. Activity data belongs to the City of Vancouver and is mirrored from{' '}
        <a
          className="underline"
          href="https://anc.ca.apm.activecommunities.com/vancouver/calendars"
          target="_blank"
          rel="noopener noreferrer"
        >
          ActiveNet
        </a>
        . Always confirm details there before attending.
      </footer>
    </>
  )
}

interface VisibleLocationsProps {
  index: SnapshotIndex
  centerIds: number[]
  onSelect: (centerId: number) => void
}

/** The locations stacked into the time grid; clicking one narrows the view to it. */
function VisibleLocations({ index, centerIds, onSelect }: VisibleLocationsProps) {
  if (centerIds.length === 0) return null
  return (
    <details className="text-muted-foreground text-xs" data-testid="visible-locations">
      <summary className="cursor-pointer select-none">
        {centerIds.length} {centerIds.length === 1 ? 'location' : 'locations'} shown
      </summary>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {centerIds.map((id) => (
          <li key={id}>
            <button
              type="button"
              className="hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => onSelect(id)}
            >
              {index.centerById.get(id)?.name}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Legend({ groups }: { groups: string[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-3 text-xs" aria-label="Calendar groups">
      {groups.map((group) => (
        <li key={group} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', groupStyle(group).dot)} />
          {group}
        </li>
      ))}
    </ul>
  )
}

/** Keep the default week inside the snapshot's period. */
function clampWeek(week: DateString, index: SnapshotIndex): DateString {
  const first = startOfWeek(index.snapshot.period.start)
  const last = startOfWeek(index.snapshot.period.end)
  return week < first ? first : week > last ? last : week
}
