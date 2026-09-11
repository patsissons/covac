import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useElementHeight } from './useElementHeight'

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const height = useElementHeight(ref)
  return (
    <div ref={ref} data-testid="box">
      {height}
    </div>
  )
}

describe('useElementHeight', () => {
  it('reports the measured height of the element', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 37,
    } as DOMRect)
    render(<Probe />)
    expect(screen.getByTestId('box')).toHaveTextContent('37')
    vi.restoreAllMocks()
  })
})
