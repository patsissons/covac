import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-registers cleanup when test globals exist;
// vitest runs without globals, so unmount between tests explicitly.
afterEach(cleanup)
