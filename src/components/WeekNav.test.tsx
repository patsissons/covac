import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WeekNav } from './WeekNav'

const period = { start: '2026-09-06', end: '2026-11-01' }

describe('WeekNav', () => {
  it('shows the week range and steps by seven days', async () => {
    const onChange = vi.fn()
    render(<WeekNav weekStart="2026-09-14" period={period} onChange={onChange} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Sep 14, 2026 – Sep 20, 2026',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(onChange).toHaveBeenCalledWith('2026-09-21')
    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(onChange).toHaveBeenCalledWith('2026-09-07')
  })

  it('picks a day from the calendar and reports its week', async () => {
    const onChange = vi.fn()
    render(<WeekNav weekStart="2026-09-14" period={period} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a day' }))
    await userEvent.click(await screen.findByRole('button', { name: /Wednesday, September 23rd/ }))
    expect(onChange).toHaveBeenCalledWith('2026-09-21', '2026-09-23')
  })

  it('disables navigation outside the snapshot period', () => {
    render(<WeekNav weekStart="2026-08-31" period={period} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next week' })).toBeEnabled()
  })
})
