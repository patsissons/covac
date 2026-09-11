import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { index } from '@/test/fixture'
import { ActivityPanel } from './ActivityPanel'

describe('ActivityPanel', () => {
  it('renders nothing when no activity is selected', () => {
    render(<ActivityPanel index={index} activityId={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows activity details, sessions and the ActiveNet link', () => {
    render(<ActivityPanel index={index} activityId={1} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Free Swim')
    expect(dialog).toHaveTextContent('Britannia Pool · Britannia Pool')
    expect(dialog).toHaveTextContent('All ages')
    expect(dialog).toHaveTextContent('100 openings remaining')
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent('Sep 1, 2026 – Nov 10, 2026')
    expect(dialog).toHaveTextContent('Sessions (2)')
    expect(dialog).toHaveTextContent('Recreational swim for everyone.')
    expect(screen.getByRole('link', { name: /ActiveNet/ })).toHaveAttribute(
      'href',
      'https://example.com/free-swim/1',
    )
  })

  it('lists the full fee table when available', () => {
    render(<ActivityPanel index={index} activityId={2} onClose={() => {}} />)
    const fees = screen.getByRole('list', { name: 'Fees' })
    expect(fees).toHaveTextContent('Drop-in$5.00')
    expect(fees).toHaveTextContent('10 visit pass$40.00')
  })

  it('calls onClose when dismissed', async () => {
    const onClose = vi.fn()
    render(<ActivityPanel index={index} activityId={2} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
