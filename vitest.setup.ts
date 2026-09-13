import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-registers cleanup when test globals exist;
// vitest runs without globals, so unmount between tests explicitly.
afterEach(cleanup)

// jsdom lacks a few layout APIs that cmdk and Radix rely on. (Node-environment test files, such
// as the MCP handler tests, have no Element at all, hence the guards.)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
