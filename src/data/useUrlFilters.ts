import { useCallback, useEffect, useState } from 'react'
import type { DateString } from './dates'
import type { Filters } from './filters'
import { filtersFromSearch, filtersToSearch } from './url'

/** Filters held in the URL query string so any view is shareable and survives reload. */
export function useUrlFilters(defaultWeek: DateString): [Filters, (next: Filters) => void] {
  const [filters, setFilters] = useState(() =>
    filtersFromSearch(window.location.search, defaultWeek),
  )

  useEffect(() => {
    const onPopState = () => setFilters(filtersFromSearch(window.location.search, defaultWeek))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [defaultWeek])

  const update = useCallback(
    (next: Filters) => {
      setFilters(next)
      const search = filtersToSearch(next, defaultWeek)
      const url = `${window.location.pathname}${search}${window.location.hash}`
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`)
        window.history.replaceState(null, '', url)
    },
    [defaultWeek],
  )

  return [filters, update]
}
