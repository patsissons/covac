import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { applyFilters, emptyFilters, groupByCenterAndDay } from '@/data/filters'
import { index } from '@/test/fixture'
import { WeekGrid } from './WeekGrid'

const week = '2026-09-07'
const grid = groupByCenterAndDay(index, applyFilters(index, emptyFilters(week)))

describe('WeekGrid', () => {
  it('renders a row per centre and a column per day', () => {
    render(
      <WeekGrid
        index={index}
        weekStart={week}
        grid={grid}
        days={[]}
        onSelect={() => {}}
        compact={false}
        selectedDay={week}
        onSelectDay={() => {}}
      />,
    )
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
    expect(screen.getByRole('rowheader', { name: 'Britannia Pool' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Hastings Community Centre' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Free Swim/ })).toHaveLength(2)
  })

  it('reports the selected activity on chip click', async () => {
    const onSelect = vi.fn()
    render(
      <WeekGrid
        index={index}
        weekStart={week}
        grid={grid}
        days={[]}
        onSelect={onSelect}
        compact={false}
        selectedDay={week}
        onSelectDay={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Basketball Drop-in/ }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('only shows selected days', () => {
    render(
      <WeekGrid
        index={index}
        weekStart={week}
        grid={grid}
        days={[6]}
        onSelect={() => {}}
        compact={false}
        selectedDay={week}
        onSelectDay={() => {}}
      />,
    )
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Sat Sep 12' })).toBeInTheDocument()
  })

  it('shows one day at a time in compact mode with day tabs', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekGrid
        index={index}
        weekStart={week}
        grid={grid}
        days={[]}
        onSelect={() => {}}
        compact
        selectedDay="2026-09-08"
        onSelectDay={onSelectDay}
      />,
    )
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Tue Sep 8' })).toBeInTheDocument()
    // Only centres with sessions that day are listed.
    expect(
      screen.queryByRole('rowheader', { name: 'Hastings Community Centre' }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Sat 12' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-12')
  })

  it('shows an empty state when nothing matches', () => {
    render(
      <WeekGrid
        index={index}
        weekStart={week}
        grid={new Map()}
        days={[]}
        onSelect={() => {}}
        compact={false}
        selectedDay={week}
        onSelectDay={() => {}}
      />,
    )
    expect(screen.getByText(/No sessions match/)).toBeInTheDocument()
  })
})
