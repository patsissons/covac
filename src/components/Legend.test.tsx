import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { index } from '@/test/fixture'
import { Legend } from './Legend'

describe('Legend', () => {
  it('lists every group and toggles one on click', async () => {
    const onToggleGroup = vi.fn()
    render(<Legend index={index} calendarIds={[]} onToggleGroup={onToggleGroup} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Sports' }))
    expect(onToggleGroup).toHaveBeenCalledWith('Sports')
  })

  it('marks fully selected groups pressed and dims unselected ones while filtering', () => {
    render(<Legend index={index} calendarIds={[55, 3]} onToggleGroup={() => {}} />)
    expect(screen.getByRole('button', { name: 'Drop-in' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sports' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sports' }).className).toContain('opacity-40')
  })
})
