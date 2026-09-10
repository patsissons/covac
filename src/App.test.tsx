import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the site heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'covac' })).toBeInTheDocument()
  })

  it('renders exactly one heading after a second render', () => {
    // A second render in the same file guards the explicit cleanup in vitest.setup.ts.
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
