import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { emptyFilters, type Filters } from '@/data/filters'
import { index } from '@/test/fixture'
import { FilterBar } from './FilterBar'

const week = '2026-09-07'

describe('FilterBar', () => {
  it('shows the result count and no clear button by default', () => {
    render(
      <FilterBar index={index} filters={emptyFilters(week)} onChange={() => {}} resultCount={3} />,
    )
    expect(screen.getByText('3 sessions this week')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument()
  })

  it('toggles a day and updates the search text', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar index={index} filters={emptyFilters(week)} onChange={onChange} resultCount={3} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sat' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ days: [6] }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search activities' }), 's')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ q: 's' }))
  })

  // Holds the filters in state like the app does, so each slider commit reaches the slider.
  function Harness({ onChange }: { onChange: (filters: Filters) => void }) {
    const [filters, setFilters] = useState(emptyFilters(week))
    const change = (next: Filters) => {
      setFilters(next)
      onChange(next)
    }
    return <FilterBar index={index} filters={filters} onChange={change} resultCount={3} />
  }

  it('walks the maximum price thumb down to free only', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    expect(screen.getByTestId('price-range')).toHaveTextContent('Free – $5')
    // Page keys move the focused thumb a tenth of the track.
    screen.getByRole('slider', { name: 'Maximum price' }).focus()
    await userEvent.keyboard('{PageDown>10/}')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceMin: null, priceMax: 0 }),
    )
    expect(screen.getByTestId('price-range')).toHaveTextContent('Free')
  })

  it('raises the minimum price thumb', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    // The slider is quadratic: six tenths up a $5 track is $1.80, shown as $2.
    screen.getByRole('slider', { name: 'Minimum price' }).focus()
    await userEvent.keyboard('{PageUp>6/}')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceMin: 2, priceMax: null }),
    )
    expect(screen.getByTestId('price-range')).toHaveTextContent('$2 – $5')
  })

  it('describes a committed price range', () => {
    render(
      <FilterBar
        index={index}
        filters={{ ...emptyFilters(week), priceMin: 1, priceMax: 3 }}
        onChange={() => {}}
        resultCount={3}
      />,
    )
    expect(screen.getByTestId('price-range')).toHaveTextContent('$1 – $3')
    expect(screen.getByRole('button', { name: /Clear filters/ })).toBeInTheDocument()
  })

  it('selects a calendar from the grouped list', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar index={index} filters={emptyFilters(week)} onChange={onChange} resultCount={3} />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('option', { name: /Public Swimming/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ calendarIds: [55] }))
  })

  it('toggles a whole group from its "All" row', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar index={index} filters={emptyFilters(week)} onChange={onChange} resultCount={3} />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('option', { name: 'All Drop-in' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ calendarIds: [55, 3] }))
    // Single-calendar groups get no "All" row.
    expect(screen.queryByRole('option', { name: 'All Sports' })).not.toBeInTheDocument()
  })

  it('clears all filters', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        index={index}
        filters={{ ...emptyFilters(week), q: 'swim', days: [6] }}
        onChange={onChange}
        resultCount={1}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Clear filters/ }))
    expect(onChange).toHaveBeenLastCalledWith(emptyFilters(week))
  })
})
