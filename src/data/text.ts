/**
 * Plain-text rendering of the sanitized description HTML the scraper stores. The scraper allows
 * only `p, br, b, strong, i, em, u, ul, ol, li, a[href]`, so a few replacements are enough; there
 * is no DOM dependency, which keeps this usable from the build and from Cloudflare Workers.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Decode the entities sanitize-html emits plus numeric references. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1]?.toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

/** Sanitized description HTML → readable plain text with paragraphs, list dashes and link URLs. */
export function htmlToText(html: string): string {
  if (!html) return ''
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|ul|ol)>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(
      /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, label: string) => {
        const plain = label.replace(/<[^>]+>/g, '').trim()
        return !plain || plain === href ? href : `${plain} (${href})`
      },
    )
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** First `max` characters of the text, cut at a word boundary with an ellipsis. */
export function blurb(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.lastIndexOf(' ', max - 1)
  return `${flat.slice(0, cut > max / 2 ? cut : max - 1).trimEnd()}…`
}
