import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyFilters } from '@/data/filters'
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

  it('selects a calendar from the grouped list', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar index={index} filters={emptyFilters(week)} onChange={onChange} resultCount={3} />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('option', { name: /Public Swimming/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ calendarIds: [55] }))
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
