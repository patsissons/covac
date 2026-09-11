import { useLayoutEffect, useState, type RefObject } from 'react'

/** Rendered height in px of the element behind `ref`, kept current as it resizes. */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setHeight(el.getBoundingClientRect().height)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}
