import { describe, expect, it } from 'vitest'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  buildSiteMeta,
  occurrencesByActivity,
} from '../../src/data/catalog.ts'
import { index, snapshot } from '../../src/test/fixture.ts'
import { centreMarkdown, llmsFullTxt, llmsTxt } from './llms.ts'

const meta = buildSiteMeta(snapshot, '1.0.0')
const centres = buildCentres(snapshot).centres
const ctx = { meta, centres, calendars: snapshot.calendars }
const catalog = buildCatalog(snapshot)
const sessions = occurrencesByActivity(snapshot.occurrences)

describe('llmsTxt', () => {
  const text = llmsTxt(ctx)
  it('follows the llms.txt shape', () => {
    expect(text.startsWith('# covac\n\n> covac (City of Vancouver Active Communities)')).toBe(true)
    expect(text).toContain(
      '2 drop-in activities and registered programs with 3 scheduled sessions at 2 community centres',
    )
    expect(text).toContain('## How to query')
    expect(text).toContain('https://covac.fyi/mcp')
    expect(text).toContain('## Centres\n')
    expect(text).toContain(
      '- [Britannia Pool](https://covac.fyi/llms/centres/37.md): 1 activities, 1661 Napier Street, Vancouver, (604) 718-5831',
    )
    expect(text).toContain('- Public Swimming (Drop-in, id 55)')
    expect(text).toContain('## Optional')
  })
})

describe('llmsFullTxt', () => {
  it('lists every activity under its centre', () => {
    const byCentre = new Map<number, typeof catalog.activities>()
    for (const a of catalog.activities)
      byCentre.set(a.centerId, [...(byCentre.get(a.centerId) ?? []), a])
    const text = llmsFullTxt(ctx, byCentre)
    expect(text).toContain('### Britannia Pool')
    expect(text).toContain(
      '- [Free Swim](https://covac.fyi/activities/1/) · Public Swimming · Free · All ages · 2 sessions',
    )
    expect(text).toContain('### Hastings Community Centre')
    expect(text).toContain('[Basketball Drop-in](https://covac.fyi/activities/2/)')
  })
})

describe('centreMarkdown', () => {
  it('embeds full write-ups under group headings', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[0]!,
      sessions.get(1)!,
      '2026-09-08',
    )
    const md = centreMarkdown(centres[0]!, [detail], '2026-09-08')
    expect(
      md.startsWith(
        '# Britannia Pool\n\n1661 Napier Street, Vancouver · (604) 718-5831 · https://www.openstreetmap.org/',
      ),
    ).toBe(true)
    expect(md).toContain('## Drop-in\n\n### Free Swim\n\n- Centre: Britannia Pool')
    expect(md).toContain('#### Upcoming sessions (Vancouver time)')
    expect(md).toContain('https://covac.fyi/activities/{id}/')
  })
})
