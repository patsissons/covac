/** `sitemap.xml` for the prerendered pages (a few thousand URLs fits one file). */
import { esc } from './html.ts'

export interface SitemapEntry {
  loc: string
  /** `YYYY-MM-DD` */
  lastmod?: string
}

export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) =>
        `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}</url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
