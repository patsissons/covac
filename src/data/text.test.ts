import { describe, expect, it } from 'vitest'
import { blurb, decodeEntities, htmlToText } from './text'

describe('htmlToText', () => {
  it('turns paragraphs, breaks and lists into lines', () => {
    const html =
      '<p>Continuous <b>length</b> swim.</p><p>Bring:<br />a towel</p><ul><li>Lane 1</li><li>Lane 2</li></ul>'
    expect(htmlToText(html)).toBe(
      'Continuous length swim.\n\nBring:\na towel\n\n- Lane 1\n- Lane 2',
    )
  })

  it('keeps link targets', () => {
    expect(htmlToText('<p>See <a href="https://x.test/a">the schedule</a>.</p>')).toBe(
      'See the schedule (https://x.test/a).',
    )
    expect(htmlToText('<p><a href="https://x.test">https://x.test</a></p>')).toBe('https://x.test')
  })

  it('decodes entities and collapses whitespace', () => {
    expect(htmlToText('<p>Kids &amp; teens&nbsp;&#8211; 5 &lt; 10</p>')).toBe(
      'Kids & teens – 5 < 10',
    )
    expect(htmlToText('')).toBe('')
  })
})

describe('decodeEntities', () => {
  it('leaves unknown entities alone', () => {
    expect(decodeEntities('a &bogus; b &#x27;c&#x27;')).toBe("a &bogus; b 'c'")
  })
})

describe('blurb', () => {
  it('returns short text unchanged and cuts long text at a word', () => {
    expect(blurb('Short text')).toBe('Short text')
    const long = 'word '.repeat(60).trim()
    const cut = blurb(long, 50)
    expect(cut.length).toBeLessThanOrEqual(50)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut).not.toMatch(/ …$/)
  })
})
