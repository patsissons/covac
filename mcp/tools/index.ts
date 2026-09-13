/** Every tool, in the order `tools/list` returns them (deterministic, per the 2026-07-28 spec). */
import { fetchTool } from './fetch.ts'
import { findActivities } from './findActivities.ts'
import { getActivity } from './getActivity.ts'
import { getSchedule } from './getSchedule.ts'
import { listCalendars } from './listCalendars.ts'
import { listCentres } from './listCentres.ts'
import { search } from './search.ts'
import { snapshotInfo } from './snapshotInfo.ts'
import type { ToolDef } from './types.ts'

export const TOOLS: readonly ToolDef[] = [
  search,
  fetchTool,
  findActivities,
  getActivity,
  listCentres,
  listCalendars,
  getSchedule,
  snapshotInfo,
]
