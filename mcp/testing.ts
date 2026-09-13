/** Test doubles for the Pages environment: an ASSETS binding backed by in-memory shards. */
import type { Assets } from './env.ts'

export interface FakeAssets extends Assets {
  /** Paths fetched so far, in order. */
  requests: string[]
}

export function fakeAssets(shards: Map<string, unknown>): FakeAssets {
  const requests: string[] = []
  return {
    requests,
    async fetch(input) {
      const url = new URL(input instanceof Request ? input.url : input)
      requests.push(url.pathname)
      const rel = url.pathname.replace(/^\//, '')
      if (!shards.has(rel)) return new Response('Not found', { status: 404 })
      return new Response(JSON.stringify(shards.get(rel)), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  }
}
