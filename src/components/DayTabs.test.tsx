import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayTabs } from './DayTabs'

const days = ['2026-09-07', '2026-09-08', '2026-09-09']

describe('DayTabs', () => {
  it('marks the selected day and reports clicks', async () => {
    const onSelect = vi.fn()
    render(<DayTabs days={days} selected="2026-09-08" onSelect={onSelect} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Mon 7', 'Tue 8', 'Wed 9'])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(tabs[2]!)
    expect(onSelect).toHaveBeenCalledWith('2026-09-09')
  })

  it('sticks to the top of the page with an opaque background', () => {
    render(<DayTabs days={days} selected={days[0]!} onSelect={() => {}} />)
    const strip = screen.getByRole('tablist', { name: 'Day' })
    expect(strip).toHaveClass('sticky', 'top-0', 'bg-background')
  })
})
