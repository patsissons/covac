import { useEffect, useState } from 'react'
import type { Snapshot } from '@/types/snapshot'
import { buildIndex, type SnapshotIndex } from './index'

export const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/snapshot.json`

export type SnapshotState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; index: SnapshotIndex }

export async function loadSnapshot(
  url = SNAPSHOT_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Snapshot> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`)
  return (await res.json()) as Snapshot
}

/** Load the snapshot once and expose it as an index. */
export function useSnapshot(url = SNAPSHOT_URL): SnapshotState {
  const [state, setState] = useState<SnapshotState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    loadSnapshot(url)
      .then((snapshot) => {
        if (!cancelled) setState({ status: 'ready', index: buildIndex(snapshot) })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return state
}
